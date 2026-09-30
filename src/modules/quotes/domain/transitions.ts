import type { QuoteStatus } from "./status";

// The quote state machine (docs/foundation-proposal.md §B.3). Commands ask it
// whether an event is allowed; they never set a status directly.
//
// - send: numbers the quote (first time), snapshots the customer, opens a link.
// - view: the customer opens the link; only a SENT quote changes (to VIEWED),
//   later opens leave the status alone.
// - revise: back to DRAFT as the next revision; the old link is revoked.
// - delete: drafts that were never sent only (checked by the command: no number).
// - cancel on APPROVED: only before it's converted (checked by the command).
// - convert: an APPROVED quote becomes an invoice and stays APPROVED.

export const QUOTE_EVENTS = [
  "send",
  "view",
  "approve",
  "reject",
  "expire",
  "revise",
  "cancel",
  "delete",
  "convert",
] as const;
export type QuoteEvent = (typeof QUOTE_EVENTS)[number];

type Target = QuoteStatus | "DELETED";

const OPEN = { approve: "APPROVED", reject: "REJECTED", expire: "EXPIRED", revise: "DRAFT", cancel: "CANCELLED" } as const;

const TRANSITIONS: Record<QuoteStatus, Partial<Record<QuoteEvent, Target>>> = {
  DRAFT: { send: "SENT", cancel: "CANCELLED", delete: "DELETED" },
  SENT: { view: "VIEWED", ...OPEN },
  VIEWED: { view: "VIEWED", ...OPEN },
  APPROVED: { view: "APPROVED", cancel: "CANCELLED", convert: "APPROVED" },
  REJECTED: { view: "REJECTED", revise: "DRAFT" },
  EXPIRED: { view: "EXPIRED", revise: "DRAFT", cancel: "CANCELLED" },
  CANCELLED: { view: "CANCELLED" },
};

export type QuoteTransition =
  | { ok: true; to: Target }
  | { ok: false; from: QuoteStatus; event: QuoteEvent };

export function transitionQuote(from: QuoteStatus, event: QuoteEvent): QuoteTransition {
  const to = TRANSITIONS[from][event];
  return to ? { ok: true, to } : { ok: false, from, event };
}

/** Statuses whose content can be edited in place (a sent quote is revised instead). */
export const EDITABLE_QUOTE_STATUSES: readonly QuoteStatus[] = ["DRAFT"];
