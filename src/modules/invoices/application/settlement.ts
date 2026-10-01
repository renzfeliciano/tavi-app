import { eq } from "drizzle-orm";
import type { Executor } from "@/db";
import type { OrgActor } from "@/modules/authz";
import { setShareLinksExpiry } from "@/modules/documents";
import type { CalendarDate } from "@/shared/dates/calendar";
import { invoiceLinkExpiresAt, issuedInvoiceStatus, type IssuedInvoiceStatus } from "../domain/issuing";
import { invoices } from "../schema";
import { loadHeader } from "./invoices";

// The invoices side of payments (§B.5). The payments module calls these inside
// its own transaction; it never touches the invoice tables. The invoice stays
// the one place its status is decided (issuedInvoiceStatus, §B.4).

/** Locks an invoice before a payment is recorded or voided (lock order: invoice, then payments). */
export function lockInvoiceForPayment(tx: Executor, actor: Pick<OrgActor, "organizationId">, invoiceId: string) {
  return loadHeader(tx, actor, invoiceId, true);
}

/**
 * Sets what has been settled on an invoice (active payments plus tax
 * withheld) and recomputes its status. A paid invoice's link closes 90 days
 * after its last payment; if a void reopens it, the link follows the due date
 * again (§I).
 */
export async function settleInvoice(
  tx: Executor,
  actor: Pick<OrgActor, "organizationId">,
  invoice: { id: string; totalMinor: number; dueDate: CalendarDate },
  { settledMinor, lastPaidOn, today }: { settledMinor: number; lastPaidOn: CalendarDate | null; today: CalendarDate },
): Promise<IssuedInvoiceStatus> {
  const status = issuedInvoiceStatus({ totalMinor: invoice.totalMinor, paidMinor: settledMinor, dueDate: invoice.dueDate }, today);
  await tx.update(invoices).set({ amountPaidMinor: settledMinor, status }).where(eq(invoices.id, invoice.id));
  await setShareLinksExpiry(
    tx,
    { organizationId: actor.organizationId, documentKind: "invoice", documentId: invoice.id },
    invoiceLinkExpiresAt(invoice.dueDate, status === "PAID" && lastPaidOn ? { paidOn: lastPaidOn } : undefined),
  );
  return status;
}
