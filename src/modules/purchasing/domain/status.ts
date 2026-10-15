/** Every stored purchase order status (docs/superpowers/specs/2026-10-15-purchase-orders-design.md, P4). */
export const PO_STATUSES = ["DRAFT", "ISSUED", "RECEIVED", "CANCELLED"] as const;

export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];
