import { and, eq, inArray, lt } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import type { CalendarDate } from "@/shared/dates/calendar";
import { invoices } from "../schema";

// The daily status job's invoice step (§B.4, D5): unpaid or part-paid invoices
// past their due date (in the business's time zone) become OVERDUE. Payments
// and edits recompute the status themselves; this only catches the calendar.
// Idempotent; audited as the system.

/** Marks this business's invoices overdue as of `today`; returns how many changed. */
export async function markOverdueInvoices(organizationId: string, today: CalendarDate, db: Database = getDb()): Promise<number> {
  return db.transaction(async (tx) => {
    const changed = await tx
      .update(invoices)
      .set({ status: "OVERDUE" })
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          inArray(invoices.status, ["SENT", "PARTIALLY_PAID"]),
          lt(invoices.dueDate, today),
        ),
      )
      .returning({ id: invoices.id, number: invoices.number, dueDate: invoices.dueDate });
    for (const invoice of changed) {
      await recordAuditEvent(tx, {
        action: "invoice.overdue",
        actorType: "system",
        organizationId,
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { number: invoice.number, dueDate: invoice.dueDate },
      });
    }
    return changed.length;
  });
}
