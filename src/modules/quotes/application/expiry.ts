import { and, eq, inArray, lt } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import type { CalendarDate } from "@/shared/dates/calendar";
import { quotes } from "../schema";

// The daily status job's quote step (§B.3, D5): sent or viewed quotes whose
// valid-until day has passed (in the business's time zone) become EXPIRED.
// Approving re-checks the date itself, so this is for lists and the customer's
// page. Idempotent; audited as the system.

/** Expires this business's lapsed quotes as of `today`; returns how many changed. */
export async function expireQuotesPastValidity(
  organizationId: string,
  today: CalendarDate,
  db: Database = getDb(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const changed = await tx
      .update(quotes)
      .set({ status: "EXPIRED" })
      .where(
        and(eq(quotes.organizationId, organizationId), inArray(quotes.status, ["SENT", "VIEWED"]), lt(quotes.validUntil, today)),
      )
      .returning({ id: quotes.id, number: quotes.number, validUntil: quotes.validUntil });
    for (const quote of changed) {
      await recordAuditEvent(tx, {
        action: "quote.expired",
        actorType: "system",
        organizationId,
        entityType: "quote",
        entityId: quote.id,
        metadata: { number: quote.number, validUntil: quote.validUntil },
      });
    }
    return changed.length;
  });
}
