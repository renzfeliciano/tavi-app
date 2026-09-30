import type { InvoiceStatus } from "./status";

// The invoice state machine (docs/foundation-proposal.md §B.4). Commands ask
// it whether an event is allowed; they never set a status directly.
//
// - issue: numbers the invoice, snapshots the customer, opens a link; the
//   status then comes from issuedInvoiceStatus (SENT, or OVERDUE if the due
//   date has already passed).
// - edit: a sent invoice with no active payments (D7; the command checks
//   payments). The status is recomputed afterwards.
// - void / cancel: terminal, reason required, only without active payments
//   (D6: void = issued in error, cancel = the sale was called off).
// - delete: drafts that were never issued (checked by the command: no number).

export const INVOICE_EVENTS = ["issue", "edit", "void", "cancel", "delete"] as const;
export type InvoiceEvent = (typeof INVOICE_EVENTS)[number];

type Target = InvoiceStatus | "DELETED";

const UNPAID = { void: "VOID", cancel: "CANCELLED" } as const;

const TRANSITIONS: Record<InvoiceStatus, Partial<Record<InvoiceEvent, Target>>> = {
  DRAFT: { issue: "SENT", delete: "DELETED" },
  SENT: { edit: "SENT", ...UNPAID },
  OVERDUE: { edit: "OVERDUE", ...UNPAID },
  PARTIALLY_PAID: {},
  PAID: {},
  VOID: {},
  CANCELLED: {},
};

export type InvoiceTransition =
  | { ok: true; to: Target }
  | { ok: false; from: InvoiceStatus; event: InvoiceEvent };

export function transitionInvoice(from: InvoiceStatus, event: InvoiceEvent): InvoiceTransition {
  const to = TRANSITIONS[from][event];
  return to ? { ok: true, to } : { ok: false, from, event };
}

/** Statuses whose content can be edited in place as a draft. */
export const EDITABLE_INVOICE_STATUSES: readonly InvoiceStatus[] = ["DRAFT"];
