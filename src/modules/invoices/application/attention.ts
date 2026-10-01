import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import { invoices } from "../schema";

// What the dashboard asks of invoices (§G.2): what's overdue, and the money
// strip's outstanding and overdue totals. Overdue is judged by the due date
// itself, so it's right even before the daily status job runs (§B.4).
// Totals are per currency and never summed across currencies (§B.2).

const OWING = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;

export type OverdueInvoice = {
  id: string;
  number: string | null;
  currency: string;
  balanceMinor: number;
  dueDate: CalendarDate;
  customerName: string | null;
};

export async function overdueInvoices(
  actor: OrgActor,
  { today, limit }: { today: CalendarDate; limit: number },
  db: Database = getDb(),
): Promise<OverdueInvoice[]> {
  assertCan(actor, "invoices.read");
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      currency: invoices.currency,
      balanceMinor: sql<number>`(${invoices.totalMinor} - ${invoices.amountPaidMinor})::bigint`.mapWith(Number),
      dueDate: invoices.dueDate,
      customerName: sql<string | null>`${invoices.customerSnapshot}->>'displayName'`,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, [...OWING]), lt(invoices.dueDate, today)))
    .orderBy(invoices.dueDate)
    .limit(limit);
}

export type InvoiceMoney = { currency: string; outstandingMinor: number; overdueMinor: number };

/** Outstanding (everything still owed) and overdue (owed past its due date), per currency. */
export async function invoiceMoneySummary(
  actor: OrgActor,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<InvoiceMoney[]> {
  assertCan(actor, "invoices.read");
  const balance = sql`${invoices.totalMinor} - ${invoices.amountPaidMinor}`;
  return db
    .select({
      currency: invoices.currency,
      outstandingMinor: sql<number>`coalesce(sum(${balance}), 0)::bigint`.mapWith(Number),
      overdueMinor: sql<number>`coalesce(sum(${balance}) filter (where ${invoices.dueDate} < ${today}), 0)::bigint`.mapWith(Number),
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, [...OWING])))
    .groupBy(invoices.currency)
    .orderBy(invoices.currency);
}
