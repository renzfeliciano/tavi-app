import { addDays, type CalendarDate, compareDates } from "@/shared/dates/calendar";
import type { InvoiceStatus } from "./status";

// Issuing an invoice, and the one status rule for issued invoices (§B.4).

/**
 * How long a customer's invoice link stays open after the due date. Interim
 * until payments (1.8) close links 90 days after an invoice is paid (§I).
 */
export const INVOICE_LINK_DAYS_AFTER_DUE = 365;

/** The end of the link's life: midnight UTC after the last day. */
export function invoiceLinkExpiresAt(dueDate: CalendarDate): Date {
  return new Date(`${addDays(dueDate, INVOICE_LINK_DAYS_AFTER_DUE + 1)}T00:00:00.000Z`);
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
