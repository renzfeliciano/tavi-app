import { and, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import { type PipelineStage, stageFrom } from "@/shared/pipeline/stage";
import { OWING_INVOICE_STATUSES as OWING } from "../domain/status";
import { invoices } from "../schema";

// What the dashboard asks of invoices (§G.2): what's overdue, and the money
// strip's outstanding and overdue totals. Overdue is judged by the due date
// itself, so it's right even before the daily status job runs (§B.4).
// Totals are per currency and never summed across currencies (§B.2).


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

export type InvoiceMoney = {
  currency: string;
  outstandingMinor: number;
  overdueMinor: number;
  /** How many statements are still owed, and how many of them are past due. */
  outstandingCount: number;
  overdueCount: number;
  /** The earliest due date among the overdue ones (how late the worst is), or null when none is. */
  oldestOverdueDue: CalendarDate | null;
};

/** Outstanding (everything still owed) and overdue (owed past its due date), per currency. */
export async function invoiceMoneySummary(
  actor: OrgActor,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<InvoiceMoney[]> {
  assertCan(actor, "invoices.read");
  const balance = sql`${invoices.totalMinor} - ${invoices.amountPaidMinor}`;
  const late = sql`${invoices.dueDate} < ${today}`;
  return db
    .select({
      currency: invoices.currency,
      outstandingMinor: sql<number>`coalesce(sum(${balance}), 0)::bigint`.mapWith(Number),
      overdueMinor: sql<number>`coalesce(sum(${balance}) filter (where ${late}), 0)::bigint`.mapWith(Number),
      outstandingCount: sql<number>`count(*)::int`.mapWith(Number),
      overdueCount: sql<number>`(count(*) filter (where ${late}))::int`.mapWith(Number),
      oldestOverdueDue: sql<CalendarDate | null>`(min(${invoices.dueDate}) filter (where ${late}))::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, [...OWING])))
    .groupBy(invoices.currency)
    .orderBy(invoices.currency);
}

export type InvoicePipeline = { drafts: PipelineStage; unpaid: PipelineStage; overdue: PipelineStage };

/**
 * Where the business's billing statements stand: drafts (worth their total), unpaid and overdue (worth what is
 * still owed). Unpaid includes part-paid; overdue is judged by the due date, like the money strip.
 */
export async function invoicePipeline(
  actor: OrgActor,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<InvoicePipeline> {
  assertCan(actor, "invoices.read");
  const balance = sql`${invoices.totalMinor} - ${invoices.amountPaidMinor}`;
  const draft = sql`${invoices.status} = 'DRAFT'`;
  const overdue = sql`${invoices.status} <> 'DRAFT' and ${invoices.dueDate} < ${today}`;
  const unpaid = sql`${invoices.status} <> 'DRAFT' and ${invoices.dueDate} >= ${today}`;
  const count = (condition: ReturnType<typeof sql>) => sql<number>`(count(*) filter (where ${condition}))::int`.mapWith(Number);
  const worth = (condition: ReturnType<typeof sql>, amount: ReturnType<typeof sql>) =>
    sql<number>`coalesce(sum(${amount}) filter (where ${condition}), 0)::bigint`.mapWith(Number);
  const rows = await db
    .select({
      currency: invoices.currency,
      draftCount: count(draft),
      draftMinor: worth(draft, sql`${invoices.totalMinor}`),
      unpaidCount: count(unpaid),
      unpaidMinor: worth(unpaid, balance),
      overdueCount: count(overdue),
      overdueMinor: worth(overdue, balance),
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, ["DRAFT", ...OWING])))
    .groupBy(invoices.currency);
  return {
    drafts: stageFrom(rows.map((r) => ({ currency: r.currency, count: r.draftCount, totalMinor: r.draftMinor }))),
    unpaid: stageFrom(rows.map((r) => ({ currency: r.currency, count: r.unpaidCount, totalMinor: r.unpaidMinor }))),
    overdue: stageFrom(rows.map((r) => ({ currency: r.currency, count: r.overdueCount, totalMinor: r.overdueMinor }))),
  };
}

/** How many invoices are owed and past their due date (the sidebar's badge). */
export async function countOverdueInvoices(
  actor: OrgActor,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<number> {
  assertCan(actor, "invoices.read");
  const [row] = await db
    .select({ total: count() })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, [...OWING]), lt(invoices.dueDate, today)));
  return row?.total ?? 0;
}

/** Drafts that a recurring schedule made and nobody has sent yet: what the dashboard asks the person to review. */
export async function recurringDraftsWaiting(actor: OrgActor, db: Database = getDb()): Promise<number> {
  assertCan(actor, "invoices.read");
  const [row] = await db
    .select({ value: count() })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), eq(invoices.status, "DRAFT"), isNotNull(invoices.recurringScheduleId)));
  return row?.value ?? 0;
}
