/** Every stored invoice status (docs/foundation-proposal.md §B.4, decisions D5–D6). */
export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
  "CANCELLED",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
