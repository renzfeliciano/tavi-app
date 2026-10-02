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

/** Sent and not settled: what the business is still owed (dashboard §G.2, reports D18). */
export const OWING_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const satisfies readonly InvoiceStatus[];
