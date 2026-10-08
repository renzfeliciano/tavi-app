import { and, asc, count, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb, isUniqueViolation } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { escapeLikePattern } from "@/shared/text/search";
import { CATALOG_PAGE_SIZE, type CatalogItemKind, catalogItemSchemaFor } from "../domain/catalog-item";
import { products, services, taxRates } from "../schema";

// Products and services share one set of use cases (D8: two tables, one
// shape). Queries are built against the kind's own table; only products
// read or write `sku`.

export type CatalogItem = {
  kind: CatalogItemKind;
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unitLabel: string;
  unitPriceMinor: number;
  currency: string;
  taxRateId: string | null;
  archivedAt: Date | null;
};

/** What the line-item picker needs from a product or service (§B.1 `LineSource`). */
export type LineSource = Omit<CatalogItem, "archivedAt">;

export type CatalogStatus = "active" | "archived";
export type ListCatalogItemsOptions = { search?: string | null; status?: CatalogStatus; page?: number };
export type CatalogItemList = { items: CatalogItem[]; page: number; hasMore: boolean; archivedCount: number };

/** How typed input is read: the business's locale and its market's default units. */
/** The business's locale, and the market's units (`market.units`): with `options`, items must use one. */
export type CatalogInputOptions = { locale: string; units: Record<CatalogItemKind, string> & { options?: readonly string[] } };

type FieldErrors = Partial<Record<string, string[]>>;
export type SaveCatalogItemResult =
  | { ok: true; item: CatalogItem }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; notFound: true };
export type CatalogItemActionResult = { ok: true } | { ok: false; notFound: true };

// Services have the same columns minus `sku`; typed as products so one query
// builder serves both, while `sku` is only ever touched for products.
type ItemTable = typeof products;
const TABLES: Record<CatalogItemKind, ItemTable> = {
  product: products,
  service: services as unknown as ItemTable,
};

const SKU_INDEX = "products_sku_unique";
const TAX_RATE_ERROR = "Choose a tax rate from the list.";

function columnsOf(kind: CatalogItemKind) {
  const t = TABLES[kind];
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    sku: kind === "product" ? products.sku : sql<string | null>`null`,
    unitLabel: t.unitLabel,
    unitPriceMinor: t.unitPriceMinor,
    currency: t.currency,
    taxRateId: t.taxRateId,
    archivedAt: t.archivedAt,
  };
}

const withKind = <T extends object>(kind: CatalogItemKind, row: T) => ({ kind, ...row });

const ofOrganization = (kind: CatalogItemKind, actor: OrgActor) =>
  eq(TABLES[kind].organizationId, actor.organizationId);

function searchCondition(kind: CatalogItemKind, search: string | null | undefined): SQL | undefined {
  if (!search) return undefined;
  const t = TABLES[kind];
  const pattern = `%${escapeLikePattern(search)}%`;
  return or(
    ilike(t.name, pattern),
    ilike(t.description, pattern),
    ...(kind === "product" ? [ilike(products.sku, pattern)] : []),
  );
}

export async function listCatalogItems(
  actor: OrgActor,
  kind: CatalogItemKind,
  { search = null, status = "active", page = 1 }: ListCatalogItemsOptions,
  db: Database = getDb(),
): Promise<CatalogItemList> {
  assertCan(actor, "catalog.read");
  const t = TABLES[kind];
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const statusFilter = status === "archived" ? isNotNull(t.archivedAt) : isNull(t.archivedAt);

  const [rows, [archived]] = await Promise.all([
    db
      .select(columnsOf(kind))
      .from(t)
      .where(and(ofOrganization(kind, actor), statusFilter, searchCondition(kind, search)))
      .orderBy(asc(sql`lower(${t.name})`), asc(t.id))
      .limit(CATALOG_PAGE_SIZE + 1)
      .offset((safePage - 1) * CATALOG_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(t)
      .where(and(ofOrganization(kind, actor), isNotNull(t.archivedAt))),
  ]);

  return {
    items: rows.slice(0, CATALOG_PAGE_SIZE).map((row) => withKind(kind, row)),
    page: safePage,
    hasMore: rows.length > CATALOG_PAGE_SIZE,
    archivedCount: archived?.value ?? 0,
  };
}

export async function getCatalogItem(
  actor: OrgActor,
  kind: CatalogItemKind,
  id: string,
  db: Database = getDb(),
): Promise<CatalogItem | null> {
  assertCan(actor, "catalog.read");
  if (!z.uuid().safeParse(id).success) return null;
  const t = TABLES[kind];
  const [row] = await db
    .select(columnsOf(kind))
    .from(t)
    .where(and(eq(t.id, id), ofOrganization(kind, actor)));
  return row ? withKind(kind, row) : null;
}

/** Products and services matching a search, for the line-item picker (active items only). */
export async function searchLineSources(
  actor: OrgActor,
  search: string | null,
  db: Database = getDb(),
  limit = 8,
): Promise<{ products: LineSource[]; services: LineSource[] }> {
  assertCan(actor, "catalog.read");
  const find = async (kind: CatalogItemKind) => {
    const t = TABLES[kind];
    const { archivedAt: _archivedAt, ...columns } = columnsOf(kind);
    void _archivedAt;
    const rows = await db
      .select(columns)
      .from(t)
      .where(and(ofOrganization(kind, actor), isNull(t.archivedAt), searchCondition(kind, search)))
      .orderBy(asc(sql`lower(${t.name})`), asc(t.id))
      .limit(limit);
    return rows.map((row) => withKind(kind, row));
  };
  const [productRows, serviceRows] = await Promise.all([find("product"), find("service")]);
  return { products: productRows, services: serviceRows };
}

function audit(
  tx: Executor,
  actor: OrgActor,
  kind: CatalogItemKind,
  verb: "created" | "updated" | "archived" | "restored",
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action: `${kind}.${verb}` as AuditAction,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: kind,
    entityId,
    metadata,
  });
}

/** True if the rate is one of the business's active rates. */
async function isUsableTaxRate(tx: Executor, actor: OrgActor, taxRateId: string) {
  const [row] = await tx
    .select({ id: taxRates.id })
    .from(taxRates)
    .where(
      and(
        eq(taxRates.id, taxRateId),
        eq(taxRates.organizationId, actor.organizationId),
        isNull(taxRates.archivedAt),
      ),
    );
  return Boolean(row);
}

function parseItem(kind: CatalogItemKind, input: unknown, options: CatalogInputOptions) {
  const parsed = catalogItemSchemaFor({ kind, ...options }).safeParse(input);
  if (!parsed.success) return { ok: false as const, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { sku, ...rest } = parsed.data as typeof parsed.data & { sku?: string | null };
  return { ok: true as const, values: kind === "product" ? { ...rest, sku: sku ?? null } : rest };
}

function skuTaken(error: unknown, input: unknown): SaveCatalogItemResult | null {
  if (!isUniqueViolation(error, SKU_INDEX)) return null;
  const sku = String((input as { sku?: unknown }).sku ?? "").trim();
  return { ok: false, fieldErrors: { sku: [`Another product already uses SKU ${sku}.`] } };
}

export async function createCatalogItem(
  actor: OrgActor,
  kind: CatalogItemKind,
  input: unknown,
  options: CatalogInputOptions,
  db: Database = getDb(),
): Promise<SaveCatalogItemResult> {
  assertCan(actor, "catalog.write");
  const parsed = parseItem(kind, input, options);
  if (!parsed.ok) return parsed;
  const values = parsed.values;
  const t = TABLES[kind];

  try {
    return await db.transaction(async (tx): Promise<SaveCatalogItemResult> => {
      if (values.taxRateId && !(await isUsableTaxRate(tx, actor, values.taxRateId))) {
        return { ok: false, fieldErrors: { taxRateId: [TAX_RATE_ERROR] } };
      }
      const [row] = await tx
        .insert(t)
        .values({ ...values, organizationId: actor.organizationId })
        .returning(columnsOf(kind));
      if (!row) throw new Error("Catalog item insert returned no row");
      await audit(tx, actor, kind, "created", row.id, {
        name: row.name,
        unitPriceMinor: row.unitPriceMinor,
        currency: row.currency,
      });
      return { ok: true, item: withKind(kind, row) };
    });
  } catch (error) {
    const taken = skuTaken(error, input);
    if (taken) return taken;
    throw error;
  }
}

export async function updateCatalogItem(
  actor: OrgActor,
  kind: CatalogItemKind,
  id: string,
  input: unknown,
  options: CatalogInputOptions,
  db: Database = getDb(),
): Promise<SaveCatalogItemResult> {
  assertCan(actor, "catalog.write");
  const parsed = parseItem(kind, input, options);
  if (!parsed.ok) return parsed;
  const next = parsed.values;
  if (!z.uuid().safeParse(id).success) return { ok: false, notFound: true };
  const t = TABLES[kind];

  try {
    return await db.transaction(async (tx): Promise<SaveCatalogItemResult> => {
      const [current] = await tx
        .select(columnsOf(kind))
        .from(t)
        .where(and(eq(t.id, id), ofOrganization(kind, actor)))
        .for("update");
      if (!current) return { ok: false, notFound: true };

      // A rate archived since it was chosen may stay; a newly chosen one must be active.
      if (next.taxRateId && next.taxRateId !== current.taxRateId && !(await isUsableTaxRate(tx, actor, next.taxRateId))) {
        return { ok: false, fieldErrors: { taxRateId: [TAX_RATE_ERROR] } };
      }
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
        (key) => next[key] !== current[key as keyof typeof current],
      );
      if (changed.length === 0) return { ok: true, item: withKind(kind, current) };

      const [row] = await tx.update(t).set(next).where(eq(t.id, current.id)).returning(columnsOf(kind));
      if (!row) throw new Error("Catalog item update returned no row");
      await audit(tx, actor, kind, "updated", row.id, { changed });
      return { ok: true, item: withKind(kind, row) };
    });
  } catch (error) {
    const taken = skuTaken(error, input);
    if (taken) return taken;
    throw error;
  }
}

/** Hides an item from the picker. Documents keep their own copy of each line. */
export async function archiveCatalogItem(
  actor: OrgActor,
  kind: CatalogItemKind,
  id: string,
  db: Database = getDb(),
): Promise<CatalogItemActionResult> {
  return setArchived(actor, kind, id, true, db);
}

export async function restoreCatalogItem(
  actor: OrgActor,
  kind: CatalogItemKind,
  id: string,
  db: Database = getDb(),
): Promise<CatalogItemActionResult> {
  return setArchived(actor, kind, id, false, db);
}

async function setArchived(
  actor: OrgActor,
  kind: CatalogItemKind,
  id: string,
  archive: boolean,
  db: Database,
): Promise<CatalogItemActionResult> {
  assertCan(actor, "catalog.write");
  if (!z.uuid().safeParse(id).success) return { ok: false, notFound: true };
  const t = TABLES[kind];
  return db.transaction(async (tx): Promise<CatalogItemActionResult> => {
    const [current] = await tx
      .select({ id: t.id, archivedAt: t.archivedAt })
      .from(t)
      .where(and(eq(t.id, id), ofOrganization(kind, actor)))
      .for("update");
    if (!current) return { ok: false, notFound: true };
    if ((current.archivedAt !== null) === archive) return { ok: true };
    await tx
      .update(t)
      .set({ archivedAt: archive ? sql`now()` : null })
      .where(eq(t.id, current.id));
    await audit(tx, actor, kind, archive ? "archived" : "restored", current.id);
    return { ok: true };
  });
}
