import { and, eq, inArray, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { ItemUse } from "@/modules/catalog";
import { BILLED_INVOICE_STATUSES } from "../domain/status";
import { invoiceLines, invoices } from "../schema";

/**
 * How many of the business's issued billing statements carry each of these products or services (once each,
 * however many lines), and the issue day of the latest. A draft was never issued and a void or cancelled
 * statement never happened (D6), so none of them counts, nor does a line typed by hand. Items on no issued
 * statement are left out.
 */
export async function invoiceItemUsage(actor: OrgActor, itemIds: readonly string[], db: Database = getDb()): Promise<ItemUse[]> {
  assertCan(actor, "invoices.read");
  if (itemIds.length === 0) return [];
  return db
    .select({
      itemId: sql<string>`${invoiceLines.sourceId}`,
      count: sql<number>`count(distinct ${invoiceLines.invoiceId})::int`.mapWith(Number),
      lastOn: sql<string>`to_char(max(${invoices.issueDate}), 'YYYY-MM-DD')`,
    })
    .from(invoiceLines)
    .innerJoin(invoices, and(eq(invoices.organizationId, invoiceLines.organizationId), eq(invoices.id, invoiceLines.invoiceId)))
    .where(
      and(
        eq(invoiceLines.organizationId, actor.organizationId),
        inArray(invoiceLines.sourceId, [...itemIds]),
        inArray(invoices.status, [...BILLED_INVOICE_STATUSES]),
      ),
    )
    .groupBy(invoiceLines.sourceId)
    .orderBy(invoiceLines.sourceId);
}
