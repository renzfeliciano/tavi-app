import { and, asc, count, eq, getTableColumns, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { escapeLikePattern } from "@/shared/text/search";
import { type CustomerInput, customerInputSchema } from "../domain/customer-input";
import { CUSTOMER_PAGE_SIZE } from "../domain/limits";
import { customers } from "../schema";

export type Customer = Omit<typeof customers.$inferSelect, "organizationId" | "createdAt">;
export type CustomerSummary = Pick<
  Customer,
  "id" | "displayName" | "company" | "email" | "phone" | "city" | "category" | "archivedAt"
>;

export type CustomerStatus = "active" | "archived";
export type ListCustomersOptions = { search?: string | null; status?: CustomerStatus; page?: number };
export type CustomerList = {
  customers: CustomerSummary[];
  page: number;
  hasMore: boolean;
  /** For the "Archived" tab: shown only when there are some. */
  archivedCount: number;
};

type FieldErrors = Partial<Record<keyof CustomerInput, string[]>>;
export type SaveCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; notFound: true };
export type CustomerActionResult = { ok: true } | { ok: false; notFound: true };

// Every column except the tenant key and creation time, which callers never need.
const customerColumns = (() => {
  const { organizationId, createdAt, ...rest } = getTableColumns(customers);
  void organizationId;
  void createdAt;
  return rest;
})();
const summaryColumns = {
  id: customers.id,
  displayName: customers.displayName,
  company: customers.company,
  email: customers.email,
  phone: customers.phone,
  city: customers.city,
  category: customers.category,
  archivedAt: customers.archivedAt,
};

const ofOrganization = (actor: OrgActor) => eq(customers.organizationId, actor.organizationId);

/** One page of the business's customers, by name, optionally filtered by a search. */
export async function listCustomers(
  actor: OrgActor,
  { search = null, status = "active", page = 1 }: ListCustomersOptions,
  db: Database = getDb(),
): Promise<CustomerList> {
  assertCan(actor, "customers.read");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const matches = pattern
    ? or(
        ilike(customers.displayName, pattern),
        ilike(customers.company, pattern),
        ilike(customers.email, pattern),
        ilike(customers.phone, pattern),
      )
    : undefined;
  const statusFilter = status === "archived" ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt);

  const [rows, [archived]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(customers)
      .where(and(ofOrganization(actor), statusFilter, matches))
      .orderBy(asc(sql`lower(${customers.displayName})`), asc(customers.id))
      .limit(CUSTOMER_PAGE_SIZE + 1)
      .offset((safePage - 1) * CUSTOMER_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(customers)
      .where(and(ofOrganization(actor), isNotNull(customers.archivedAt))),
  ]);

  return {
    customers: rows.slice(0, CUSTOMER_PAGE_SIZE),
    page: safePage,
    hasMore: rows.length > CUSTOMER_PAGE_SIZE,
    archivedCount: archived?.value ?? 0,
  };
}

/** The business's customer, or null (another business's id or a malformed id finds nothing). */
export async function getCustomer(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<Customer | null> {
  assertCan(actor, "customers.read");
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select(customerColumns)
    .from(customers)
    .where(and(eq(customers.id, id), ofOrganization(actor)));
  return row ?? null;
}

/** Display names for a set of the business's customers (other ids are ignored). For lists elsewhere. */
export async function getCustomerNames(
  actor: OrgActor,
  ids: readonly string[],
  db: Database = getDb(),
): Promise<Map<string, string>> {
  assertCan(actor, "customers.read");
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  if (valid.length === 0) return new Map();
  const rows = await db
    .select({ id: customers.id, displayName: customers.displayName })
    .from(customers)
    .where(and(ofOrganization(actor), inArray(customers.id, valid)));
  return new Map(rows.map((row) => [row.id, row.displayName]));
}

/** Ids of the business's customers (active or archived) matching a search, for filtering other lists. */
export async function findCustomerIds(
  actor: OrgActor,
  search: string,
  db: Database = getDb(),
  limit = 200,
): Promise<string[]> {
  assertCan(actor, "customers.read");
  const pattern = `%${escapeLikePattern(search)}%`;
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(ofOrganization(actor), or(ilike(customers.displayName, pattern), ilike(customers.company, pattern))))
    .limit(limit);
  return rows.map((row) => row.id);
}

async function findForUpdate(tx: Executor, actor: OrgActor, id: string) {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await tx
    .select(customerColumns)
    .from(customers)
    .where(and(eq(customers.id, id), ofOrganization(actor)))
    .for("update");
  return row;
}

function audit(
  tx: Executor,
  actor: OrgActor,
  action: AuditAction,
  customerId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "customer",
    entityId: customerId,
    metadata,
  });
}

export async function createCustomer(
  actor: OrgActor,
  input: unknown,
  db: Database = getDb(),
): Promise<SaveCustomerResult> {
  assertCan(actor, "customers.write");
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const customer = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customers)
      .values({ ...parsed.data, organizationId: actor.organizationId })
      .returning(customerColumns);
    if (!row) throw new Error("Customer insert returned no row");
    // Field names only: the audit log shouldn't copy contact details.
    await audit(tx, actor, "customer.created", row.id);
    return row;
  });
  return { ok: true, customer };
}

export async function updateCustomer(
  actor: OrgActor,
  id: string,
  input: unknown,
  db: Database = getDb(),
): Promise<SaveCustomerResult> {
  assertCan(actor, "customers.write");
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const next = parsed.data;

  return db.transaction(async (tx): Promise<SaveCustomerResult> => {
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    const changed = (Object.keys(next) as (keyof CustomerInput)[]).filter((key) => next[key] !== current[key]);
    if (changed.length === 0) return { ok: true, customer: current };

    const [row] = await tx
      .update(customers)
      .set(next)
      .where(eq(customers.id, current.id))
      .returning(customerColumns);
    if (!row) throw new Error("Customer update returned no row");
    await audit(tx, actor, "customer.updated", row.id, { changed });
    return { ok: true, customer: row };
  });
}

/** Hides a customer from pickers and the main list. Documents keep their own copy. */
export async function archiveCustomer(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<CustomerActionResult> {
  return setArchived(actor, id, true, db);
}

export async function restoreCustomer(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<CustomerActionResult> {
  return setArchived(actor, id, false, db);
}

async function setArchived(
  actor: OrgActor,
  id: string,
  archive: boolean,
  db: Database,
): Promise<CustomerActionResult> {
  assertCan(actor, "customers.write");
  return db.transaction(async (tx): Promise<CustomerActionResult> => {
    const current = await findForUpdate(tx, actor, id);
    if (!current) return { ok: false, notFound: true };
    if ((current.archivedAt !== null) === archive) return { ok: true };
    await tx
      .update(customers)
      .set({ archivedAt: archive ? sql`now()` : null })
      .where(eq(customers.id, current.id));
    await audit(tx, actor, archive ? "customer.archived" : "customer.restored", current.id);
    return { ok: true };
  });
}
