import { and, asc, count, eq, getTableColumns, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { type PageMeta, pageMeta, pageWindow } from "@/shared/pagination/page-window";
import { escapeLikePattern } from "@/shared/text/search";
import { type SupplierInput, supplierInputSchema } from "../domain/supplier-input";
import { suppliers } from "../schema";

export type Supplier = Omit<typeof suppliers.$inferSelect, "organizationId" | "createdAt">;
export type SupplierSummary = Pick<
  Supplier,
  "id" | "displayName" | "contactName" | "email" | "phone" | "city" | "archivedAt"
>;

export type SupplierStatus = "active" | "archived";
export type ListSuppliersOptions = { search?: string | null; status?: SupplierStatus; page?: number; pageSize?: number };
export type SupplierList = PageMeta & {
  suppliers: SupplierSummary[];
  /** For the "Archived" tab: shown only when there are some. */
  archivedCount: number;
};

type FieldErrors = Partial<Record<keyof SupplierInput, string[]>>;
export type SaveSupplierResult =
  | { ok: true; supplier: Supplier }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; notFound: true };
export type SupplierActionResult = { ok: true } | { ok: false; notFound: true };

// Every column except the tenant key and creation time, which callers never need.
const supplierColumns = (() => {
  const { organizationId, createdAt, ...rest } = getTableColumns(suppliers);
  void organizationId;
  void createdAt;
  return rest;
})();
const summaryColumns = {
  id: suppliers.id,
  displayName: suppliers.displayName,
  contactName: suppliers.contactName,
  email: suppliers.email,
  phone: suppliers.phone,
  city: suppliers.city,
  archivedAt: suppliers.archivedAt,
};

const ofOrganization = (actor: Pick<OrgActor, "organizationId">) => eq(suppliers.organizationId, actor.organizationId);

const matching = (search: string) => {
  const pattern = `%${escapeLikePattern(search)}%`;
  return or(
    ilike(suppliers.displayName, pattern),
    ilike(suppliers.contactName, pattern),
    ilike(suppliers.email, pattern),
    ilike(suppliers.phone, pattern),
  );
};

/** One page of the business's suppliers, by name, optionally filtered by a search. */
export async function listSuppliers(
  actor: OrgActor,
  { search = null, status = "active", page = 1, pageSize }: ListSuppliersOptions,
  db: Database = getDb(),
): Promise<SupplierList> {
  assertCan(actor, "purchasing.read");
  const statusFilter = status === "archived" ? isNotNull(suppliers.archivedAt) : isNull(suppliers.archivedAt);
  const where = and(ofOrganization(actor), statusFilter, search ? matching(search) : undefined);

  const [[found], [archived]] = await Promise.all([
    db.select({ value: count() }).from(suppliers).where(where),
    db
      .select({ value: count() })
      .from(suppliers)
      .where(and(ofOrganization(actor), isNotNull(suppliers.archivedAt))),
  ]);
  const window = pageWindow({ page, pageSize, matching: found?.value ?? 0 });
  const rows = await db
    .select(summaryColumns)
    .from(suppliers)
    .where(where)
    .orderBy(asc(sql`lower(${suppliers.displayName})`), asc(suppliers.id))
    .limit(window.pageSize)
    .offset(window.offset);

  return { suppliers: rows, ...pageMeta(window), archivedCount: archived?.value ?? 0 };
}

/** Active suppliers matching a search, for the order form's picker. */
export async function searchSuppliers(
  actor: OrgActor,
  search: string,
  db: Database = getDb(),
  limit = 20,
): Promise<{ id: string; displayName: string; email: string | null }[]> {
  assertCan(actor, "purchasing.read");
  const trimmed = search.trim();
  return db
    .select({ id: suppliers.id, displayName: suppliers.displayName, email: suppliers.email })
    .from(suppliers)
    .where(and(ofOrganization(actor), isNull(suppliers.archivedAt), trimmed ? matching(trimmed) : undefined))
    .orderBy(asc(sql`lower(${suppliers.displayName})`), asc(suppliers.id))
    .limit(limit);
}

/** The business's supplier, or null (another business's id or a malformed id finds nothing). */
export async function getSupplier(actor: OrgActor, id: string, db: Database = getDb()): Promise<Supplier | null> {
  assertCan(actor, "purchasing.read");
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select(supplierColumns)
    .from(suppliers)
    .where(and(eq(suppliers.id, id), ofOrganization(actor)));
  return row ?? null;
}

async function findForUpdate(tx: Executor, actor: OrgActor, id: string) {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await tx
    .select(supplierColumns)
    .from(suppliers)
    .where(and(eq(suppliers.id, id), ofOrganization(actor)))
    .for("update");
  return row;
}

function audit(
  tx: Executor,
  actor: OrgActor,
  action: AuditAction,
  supplierId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "supplier",
    entityId: supplierId,
    metadata,
  });
}

export async function createSupplier(actor: OrgActor, input: unknown, db: Database = getDb()): Promise<SaveSupplierResult> {
  assertCan(actor, "purchasing.write");
  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supplier = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(suppliers)
      .values({ ...parsed.data, organizationId: actor.organizationId })
      .returning(supplierColumns);
    if (!row) throw new Error("Supplier insert returned no row");
    // No details in the audit log: it shouldn't copy contact details.
    await audit(tx, actor, "supplier.created", row.id);
    return row;
  });
  return { ok: true, supplier };
}

export async function updateSupplier(
  actor: OrgActor,
  id: string,
  input: unknown,
  db: Database = getDb(),
): Promise<SaveSupplierResult> {
  assertCan(actor, "purchasing.write");
  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const next = parsed.data;

  return db.transaction(async (tx): Promise<SaveSupplierResult> => {
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    const changed = (Object.keys(next) as (keyof SupplierInput)[]).filter((key) => next[key] !== current[key]);
    if (changed.length === 0) return { ok: true, supplier: current };

    const [row] = await tx.update(suppliers).set(next).where(eq(suppliers.id, current.id)).returning(supplierColumns);
    if (!row) throw new Error("Supplier update returned no row");
    await audit(tx, actor, "supplier.updated", row.id, { changed });
    return { ok: true, supplier: row };
  });
}

/** Hides a supplier from pickers and the main list. Issued orders keep their own copy. */
export function archiveSupplier(actor: OrgActor, id: string, db: Database = getDb()): Promise<SupplierActionResult> {
  return setArchived(actor, id, true, db);
}

export function restoreSupplier(actor: OrgActor, id: string, db: Database = getDb()): Promise<SupplierActionResult> {
  return setArchived(actor, id, false, db);
}

async function setArchived(actor: OrgActor, id: string, archive: boolean, db: Database): Promise<SupplierActionResult> {
  assertCan(actor, "purchasing.write");
  return db.transaction(async (tx): Promise<SupplierActionResult> => {
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    if ((current.archivedAt !== null) === archive) return { ok: true };
    await tx
      .update(suppliers)
      .set({ archivedAt: archive ? sql`now()` : null })
      .where(eq(suppliers.id, current.id));
    await audit(tx, actor, archive ? "supplier.archived" : "supplier.restored", current.id);
    return { ok: true };
  });
}
