import { addDays, type CalendarDate, compareDates } from "@/shared/dates/calendar";
import type { InvoiceStatus } from "./status";

// Issuing an invoice, and the one status rule for issued invoices (§B.4).

/** How long a customer's link to an unpaid invoice stays open after its due date. */
export const INVOICE_LINK_DAYS_AFTER_DUE = 365;

/** How long the link stays open once the invoice is paid (§I). */
export const INVOICE_LINK_DAYS_AFTER_PAID = 90;

/**
 * The end of the link's life (midnight UTC after the last day): a while after
 * the due date while money is owed, then 90 days after it's paid in full.
 */
export function invoiceLinkExpiresAt(dueDate: CalendarDate, paid?: { paidOn: CalendarDate }): Date {
  const last = paid ? addDays(paid.paidOn, INVOICE_LINK_DAYS_AFTER_PAID) : addDays(dueDate, INVOICE_LINK_DAYS_AFTER_DUE);
  return new Date(`${addDays(last, 1)}T00:00:00.000Z`);
}

export type IssuedInvoiceStatus = Extract<InvoiceStatus, "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE">;

/**
 * The status of an issued (not void or cancelled) invoice, from its total,
 * the sum of its active payments and its due date in the business's time
 * zone. Never set by hand, so it can't drift (§B.4).
 */
export function issuedInvoiceStatus(
  invoice: { totalMinor: number; paidMinor: number; dueDate: CalendarDate },
  today: CalendarDate,
): IssuedInvoiceStatus {
  if (invoice.paidMinor >= invoice.totalMinor) return "PAID";
  if (compareDates(invoice.dueDate, today) < 0) return "OVERDUE";
  if (invoice.paidMinor > 0) return "PARTIALLY_PAID";
  return "SENT";
}

/** Problems that stop a draft from being issued, keyed like the editor's fields; empty when ready. */
export function readinessToIssue(invoice: { customerId: string | null; lineCount: number }): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!invoice.customerId) problems.customerId = "Choose a customer before sending.";
  if (invoice.lineCount === 0) problems.lines = "Add at least one item before sending.";
  return problems;
}

/** Whether an invoice takes payments: issued, not void or cancelled, and something still owed. */
export function isPayable(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";
}
