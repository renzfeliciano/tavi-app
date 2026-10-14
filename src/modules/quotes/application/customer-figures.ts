import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CustomerChange } from "@/modules/customers";
import { quotes } from "../schema";

/**
 * When each of these customers' sent quotations last changed (sent, viewed, approved, declined, expired).
 * A quotation that was never sent is only the business's own work, so it doesn't count; one that was sent
 * and is being revised counts from when it was sent, not for the edits to the draft. Customers with no sent
 * quotation are left out.
 */
export async function lastQuoteChanges(
  actor: OrgActor,
  customerIds: readonly string[],
  db: Database = getDb(),
): Promise<CustomerChange[]> {
  assertCan(actor, "quotes.read");
  if (customerIds.length === 0) return [];
  return db
    .select({
      customerId: sql<string>`${quotes.customerId}`,
      at: sql<Date>`max(case when ${quotes.status} = 'DRAFT' then ${quotes.sentAt} else ${quotes.updatedAt} end)`.mapWith(
        (value: string | Date) => new Date(value),
      ),
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.organizationId, actor.organizationId),
        inArray(quotes.customerId, [...customerIds]),
        isNotNull(quotes.sentAt),
      ),
    )
    .groupBy(quotes.customerId)
    .orderBy(quotes.customerId);
}
