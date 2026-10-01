import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomerNames } from "@/modules/customers";
import type { CalendarDate } from "@/shared/dates/calendar";
import type { QuoteStatus } from "../domain/status";
import { quotes } from "../schema";

// What the dashboard asks of quotes (§G.2): approved but not yet invoiced
// (the most valuable nudge), sent and unanswered for a while, and drafts left
// alone. Thresholds come from the caller (named constants, D12).

export type AttentionQuote = {
  id: string;
  number: string | null;
  status: QuoteStatus;
  currency: string;
  totalMinor: number;
  customerName: string | null;
  /** When it became relevant: decided, sent or last edited. */
  since: Date | null;
};

export type QuotesAttention = {
  approvedNotInvoiced: AttentionQuote[];
  awaitingReply: AttentionQuote[];
  staleDrafts: AttentionQuote[];
};

export async function quotesNeedingAttention(
  actor: OrgActor,
  {
    today,
    followUpBefore,
    staleBefore,
    limit,
  }: {
    /** Today in the business's time zone (expired quotes aren't waiting). */
    today: CalendarDate;
    /** Sent before this and still unanswered. */
    followUpBefore: Date;
    /** Drafts not touched since this. */
    staleBefore: Date;
    /** At most this many of each kind. */
    limit: number;
  },
  db: Database = getDb(),
): Promise<QuotesAttention> {
  assertCan(actor, "quotes.read");
  const ofOrganization = eq(quotes.organizationId, actor.organizationId);
  const select = (since: typeof quotes.decidedAt | typeof quotes.sentAt | typeof quotes.updatedAt) =>
    db
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        currency: quotes.currency,
        totalMinor: quotes.totalMinor,
        customerId: quotes.customerId,
        snapshotName: sql<string | null>`${quotes.customerSnapshot}->>'displayName'`,
        since,
      })
      .from(quotes);

  const [approved, awaiting, drafts] = await Promise.all([
    select(quotes.decidedAt)
      .where(and(ofOrganization, eq(quotes.status, "APPROVED"), isNull(quotes.convertedInvoiceId)))
      .orderBy(quotes.decidedAt)
      .limit(limit),
    select(quotes.sentAt)
      .where(
        and(
          ofOrganization,
          inArray(quotes.status, ["SENT", "VIEWED"]),
          isNotNull(quotes.sentAt),
          lt(quotes.sentAt, followUpBefore),
          gte(quotes.validUntil, today),
        ),
      )
      .orderBy(quotes.sentAt)
      .limit(limit),
    select(quotes.updatedAt)
      .where(and(ofOrganization, eq(quotes.status, "DRAFT"), lt(quotes.updatedAt, staleBefore)))
      .orderBy(desc(quotes.updatedAt))
      .limit(limit),
  ]);

  const rows = [...approved, ...awaiting, ...drafts];
  const names = await getCustomerNames(
    actor,
    rows.flatMap((row) => (row.snapshotName === null && row.customerId ? [row.customerId] : [])),
    db,
  );
  const shape = (list: typeof rows): AttentionQuote[] =>
    list.map(({ customerId, snapshotName, ...row }) => ({
      ...row,
      customerName: snapshotName ?? (customerId ? (names.get(customerId) ?? null) : null),
    }));
  return { approvedNotInvoiced: shape(approved), awaitingReply: shape(awaiting), staleDrafts: shape(drafts) };
}

/** First-run checklist progress (§G.5): has the business made a quote, and sent one? */
export async function quoteProgress(actor: OrgActor, db: Database = getDb()) {
  assertCan(actor, "quotes.read");
  const [row] = await db
    .select({
      created: count(),
      sent: sql<number>`count(*) filter (where ${quotes.number} is not null)`,
    })
    .from(quotes)
    .where(eq(quotes.organizationId, actor.organizationId));
  return { hasQuote: Number(row?.created ?? 0) > 0, hasSentQuote: Number(row?.sent ?? 0) > 0 };
}
