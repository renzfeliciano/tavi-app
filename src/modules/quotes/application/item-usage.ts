import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { ItemUse } from "@/modules/catalog";
import { quoteLines, quotes } from "../schema";

/**
 * How many of the business's sent quotations carry each of these products or services (once each, however many
 * lines), and the issue day of the latest. A draft is only the business's own work, so it doesn't count (nor does
 * one called off before it was ever sent), and a line typed by hand names no item. Items on no sent quotation are
 * left out.
 */
export async function quoteItemUsage(actor: OrgActor, itemIds: readonly string[], db: Database = getDb()): Promise<ItemUse[]> {
  assertCan(actor, "quotes.read");
  if (itemIds.length === 0) return [];
  return db
    .select({
      itemId: sql<string>`${quoteLines.sourceId}`,
      count: sql<number>`count(distinct ${quoteLines.quoteId})::int`.mapWith(Number),
      lastOn: sql<string>`to_char(max(${quotes.issueDate}), 'YYYY-MM-DD')`,
    })
    .from(quoteLines)
    .innerJoin(quotes, and(eq(quotes.organizationId, quoteLines.organizationId), eq(quotes.id, quoteLines.quoteId)))
    .where(
      and(
        eq(quoteLines.organizationId, actor.organizationId),
        inArray(quoteLines.sourceId, [...itemIds]),
        ne(quotes.status, "DRAFT"),
        isNotNull(quotes.sentAt),
      ),
    )
    .groupBy(quoteLines.sourceId)
    .orderBy(quoteLines.sourceId);
}
