import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb, isUniqueViolation } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { taxRateInputSchema } from "../domain/tax-rate";
import { taxRates } from "../schema";

export type TaxRate = Pick<
  typeof taxRates.$inferSelect,
  "id" | "name" | "rateBps" | "isDefault" | "archivedAt"
>;

export type SaveTaxRateResult =
  | { ok: true; taxRate: TaxRate }
  | { ok: false; fieldErrors: Partial<Record<"name" | "rate", string[]>> }
  | { ok: false; notFound: true };

export type TaxRateActionResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

const NAME_TAKEN_INDEX = "tax_rates_active_name_unique";
const nameTaken = (name: string) => `You already have a tax called ${name}.`;

const columns = {
  id: taxRates.id,
  name: taxRates.name,
  rateBps: taxRates.rateBps,
  isDefault: taxRates.isDefault,
  archivedAt: taxRates.archivedAt,
};

/** Every rate of the actor's organization: default first, active before archived, then by name. */
export async function listTaxRates(actor: OrgActor, db: Database = getDb()): Promise<TaxRate[]> {
  assertCan(actor, "catalog.read");
  return db
    .select(columns)
    .from(taxRates)
    .where(eq(taxRates.organizationId, actor.organizationId))
    .orderBy(
      desc(taxRates.isDefault),
      sql`${taxRates.archivedAt} is not null`,
      asc(sql`lower(${taxRates.name})`),
      asc(taxRates.id),
    );
}

/** Locks one of the organization's rates; another organization's id finds nothing. */
async function findForUpdate(tx: Executor, actor: OrgActor, id: string) {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await tx
    .select(columns)
    .from(taxRates)
    .where(and(eq(taxRates.id, id), eq(taxRates.organizationId, actor.organizationId)))
    .for("update");
  return row;
}

function audit(
  tx: Executor,
  actor: OrgActor,
  action: AuditAction,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "tax_rate",
    entityId,
    metadata,
  });
}

async function clearDefault(tx: Executor, actor: OrgActor) {
  await tx
    .update(taxRates)
    .set({ isDefault: false })
    .where(and(eq(taxRates.organizationId, actor.organizationId), eq(taxRates.isDefault, true)));
}

export async function createTaxRate(
  actor: OrgActor,
  input: unknown,
  db: Database = getDb(),
): Promise<SaveTaxRateResult> {
  assertCan(actor, "organization.manage");
  const parsed = taxRateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { name, rateBps } = parsed.data;
  const makeDefault = (input as { makeDefault?: unknown }).makeDefault === true;

  try {
    const taxRate = await db.transaction(async (tx) => {
      if (makeDefault) await clearDefault(tx, actor);
      const [row] = await tx
        .insert(taxRates)
        .values({ organizationId: actor.organizationId, name, rateBps, isDefault: makeDefault })
        .returning(columns);
      if (!row) throw new Error("Tax rate insert returned no row");
      await audit(tx, actor, "tax_rate.created", row.id, { name, rateBps });
      return row;
    });
    return { ok: true, taxRate };
  } catch (error) {
    if (isUniqueViolation(error, NAME_TAKEN_INDEX)) {
      return { ok: false, fieldErrors: { name: [nameTaken(name)] } };
    }
    throw error;
  }
}

/** Renames or re-rates. Issued documents keep the name and rate they were issued with. */
export async function updateTaxRate(
  actor: OrgActor,
  id: string,
  input: unknown,
  db: Database = getDb(),
): Promise<SaveTaxRateResult> {
  assertCan(actor, "organization.manage");
  const parsed = taxRateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { name, rateBps } = parsed.data;

  try {
    return await db.transaction(async (tx): Promise<SaveTaxRateResult> => {
      const current = await findForUpdate(tx, actor, id);
      if (!current) return { ok: false, notFound: true };
      if (current.name === name && current.rateBps === rateBps) return { ok: true, taxRate: current };
      const [row] = await tx
        .update(taxRates)
        .set({ name, rateBps })
        .where(eq(taxRates.id, current.id))
        .returning(columns);
      if (!row) throw new Error("Tax rate update returned no row");
      await audit(tx, actor, "tax_rate.updated", row.id, {
        before: { name: current.name, rateBps: current.rateBps },
        after: { name, rateBps },
      });
      return { ok: true, taxRate: row };
    });
  } catch (error) {
    if (isUniqueViolation(error, NAME_TAKEN_INDEX)) {
      return { ok: false, fieldErrors: { name: [nameTaken(name)] } };
    }
    throw error;
  }
}

/** Makes one active rate the default for new line items, or clears the default (`null`). */
export async function setDefaultTaxRate(
  actor: OrgActor,
  id: string | null,
  db: Database = getDb(),
): Promise<TaxRateActionResult> {
  assertCan(actor, "organization.manage");
  return db.transaction(async (tx): Promise<TaxRateActionResult> => {
    if (id === null) {
      await clearDefault(tx, actor);
      await audit(tx, actor, "tax_rate.default_changed", null, { defaultTaxRateId: null });
      return { ok: true };
    }
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    if (current.archivedAt) return { ok: false, error: "Restore this tax before making it the default." };
    if (current.isDefault) return { ok: true };
    await clearDefault(tx, actor);
    await tx.update(taxRates).set({ isDefault: true }).where(eq(taxRates.id, current.id));
    await audit(tx, actor, "tax_rate.default_changed", current.id, { defaultTaxRateId: current.id });
    return { ok: true };
  });
}

/** Hides a rate from new line items. Issued documents keep their own copy of it. */
export async function archiveTaxRate(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<TaxRateActionResult> {
  assertCan(actor, "organization.manage");
  return db.transaction(async (tx): Promise<TaxRateActionResult> => {
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    if (current.archivedAt) return { ok: true };
    await tx
      .update(taxRates)
      .set({ archivedAt: sql`now()`, isDefault: false })
      .where(eq(taxRates.id, current.id));
    await audit(tx, actor, "tax_rate.archived", current.id, { name: current.name });
    return { ok: true };
  });
}

export async function restoreTaxRate(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<TaxRateActionResult> {
  assertCan(actor, "organization.manage");
  let name = "";
  try {
    return await db.transaction(async (tx): Promise<TaxRateActionResult> => {
      const current = await findForUpdate(tx, actor, id);
      if (!current) return { ok: false, notFound: true };
      name = current.name;
      if (!current.archivedAt) return { ok: true };
      await tx.update(taxRates).set({ archivedAt: null }).where(eq(taxRates.id, current.id));
      await audit(tx, actor, "tax_rate.restored", current.id, { name: current.name });
      return { ok: true };
    });
  } catch (error) {
    if (isUniqueViolation(error, NAME_TAKEN_INDEX)) {
      return { ok: false, error: `${nameTaken(name)} Rename it first.` };
    }
    throw error;
  }
}
