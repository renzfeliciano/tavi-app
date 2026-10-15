import type { PurchaseOrderStatus } from "./status";

// The purchase order state machine. Commands ask it whether an event is
// allowed; they never set a status directly.
//
// - issue: numbers the order, snapshots supplier and seller.
// - receive: the goods arrived (whole order only).
// - cancel: an issued order is called off.
// - delete: drafts only (a draft has no number).

export const PO_EVENTS = ["issue", "receive", "cancel", "delete"] as const;
export type PurchaseOrderEvent = (typeof PO_EVENTS)[number];

type Target = PurchaseOrderStatus | "DELETED";

const TRANSITIONS: Record<PurchaseOrderStatus, Partial<Record<PurchaseOrderEvent, Target>>> = {
  DRAFT: { issue: "ISSUED", delete: "DELETED" },
  ISSUED: { receive: "RECEIVED", cancel: "CANCELLED" },
  RECEIVED: {},
  CANCELLED: {},
};

export type PurchaseOrderTransition =
  | { ok: true; to: Target }
  | { ok: false; from: PurchaseOrderStatus; event: PurchaseOrderEvent };

export function transitionPurchaseOrder(from: PurchaseOrderStatus, event: PurchaseOrderEvent): PurchaseOrderTransition {
  const to = TRANSITIONS[from][event];
  return to ? { ok: true, to } : { ok: false, from, event };
}
