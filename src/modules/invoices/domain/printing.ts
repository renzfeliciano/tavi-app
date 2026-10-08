import type { InvoiceStatus } from "./status";

// Reprints of registered invoices (RR 7-2024 Sec. 6 B.21, top portion (a):
// "For reprinting of invoice, the word "REPRINT" should be prominently
// indicated"). TAVI's reading (founder, 2026-10-08, D19): the first PDF made
// of an issued registered invoice is the original; every later PDF, whether
// the business or the customer downloads it, is a reprint. The web page is a
// view, not a print, so it's never marked. Billing statements and drafts
// aren't registered invoices, so their PDFs aren't counted.

export type InvoiceCopy = "original" | "reprint";

/** Whether a PDF of this invoice counts as a print of a registered invoice. */
export function countsAsPrint(invoice: { status: InvoiceStatus; registration: unknown }): boolean {
  return invoice.registration !== null && invoice.status !== "DRAFT";
}

/** The copy a print is, from its place in the count (1 = the first PDF ever made). */
export function copyForPrint(printNumber: number): InvoiceCopy {
  if (!Number.isSafeInteger(printNumber) || printNumber < 1) throw new RangeError("Print numbers start at 1");
  return printNumber === 1 ? "original" : "reprint";
}
