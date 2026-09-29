/** Every stored quote status (docs/foundation-proposal.md §B.3, decision D5). */
export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
