import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CustomerChange } from "@/modules/customers";
import type { CalendarDate } from "@/shared/dates/calendar";
import { BILLED_INVOICE_STATUSES } from "../domain/status";
import { invoices } from "../schema";

// What the customer screens ask of billing statements: how much each customer has been billed,
// has paid and still owes, and when their statements last changed. Money is per customer and
// per currency, never summed across currencies (§B.2). A draft was never issued and a void or
// cancelled statement never happened (D6), so none of them counts.

export type CustomerMoney = {
  customerId: string;
  currency: string;
  /** Everything issued to them (sent, part-paid, paid or past due). */
  billedMinor: number;
  paidMinor: number;
  /** Still owed: what is left on the statements that are not settled. */
  owedMinor: number;
  /** The part of what is owed that is past its due date. */
  overdueMinor: number;
  /** How many statements that is. */
  count: number;
};

/** The money for these customers (a page of a list, or one customer's record), one row per customer and currency. */
export async function customerMoney(
  actor: OrgActor,
  customerIds: readonly string[],
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<CustomerMoney[]> {
  assertCan(actor, "invoices.read");
  if (customerIds.length === 0) return [];
  const unsettled = sql`${invoices.status} <> 'PAID'`;
  const balance = sql`greatest(${invoices.totalMinor} - ${invoices.amountPaidMinor}, 0)`;
  const late = sql`${invoices.dueDate} < ${today}`;
  return db
    .select({
      customerId: sql<string>`${invoices.customerId}`,
      currency: invoices.currency,
      billedMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::bigint`.mapWith(Number),
      paidMinor: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::bigint`.mapWith(Number),
      owedMinor: sql<number>`coalesce(sum(${balance}) filter (where ${unsettled}), 0)::bigint`.mapWith(Number),
      overdueMinor: sql<number>`coalesce(sum(${balance}) filter (where ${unsettled} and ${late}), 0)::bigint`.mapWith(Number),
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, actor.organizationId),
        inArray(invoices.customerId, [...customerIds]),
        inArray(invoices.status, [...BILLED_INVOICE_STATUSES]),
      ),
    )
    .groupBy(invoices.customerId, invoices.currency)
    .orderBy(invoices.customerId, invoices.currency);
}

/**
 * When each of these customers' issued statements last changed (sent, viewed, paid, corrected). A payment
 * changes the statement it settles, so this is also when they last paid. Customers with no issued statement
 * are left out.
 */
export async function lastInvoiceChanges(
  actor: OrgActor,
  customerIds: readonly string[],
  db: Database = getDb(),
): Promise<CustomerChange[]> {
  assertCan(actor, "invoices.read");
  if (customerIds.length === 0) return [];
  return db
    .select({
      customerId: sql<string>`${invoices.customerId}`,
      at: sql<Date>`max(${invoices.updatedAt})`.mapWith((value: string | Date) => new Date(value)),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, actor.organizationId),
        inArray(invoices.customerId, [...customerIds]),
        ne(invoices.status, "DRAFT"),
      ),
    )
    .groupBy(invoices.customerId)
    .orderBy(invoices.customerId);
}
