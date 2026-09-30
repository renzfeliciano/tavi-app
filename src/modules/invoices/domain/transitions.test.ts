import { describe, expect, it } from "vitest";
import { INVOICE_STATUSES, type InvoiceStatus } from "./status";
import { INVOICE_EVENTS, type InvoiceEvent, transitionInvoice } from "./transitions";

// Every status × every event (§B.4). "—" means the event isn't allowed there.
// Payments move an issued invoice between SENT, PARTIALLY_PAID, PAID and
// OVERDUE through issuedInvoiceStatus, not through these events.
const EXPECTED: Record<InvoiceStatus, Record<InvoiceEvent, InvoiceStatus | "DELETED" | "—">> = {
  DRAFT: { issue: "SENT", edit: "—", void: "—", cancel: "—", delete: "DELETED" },
  SENT: { issue: "—", edit: "SENT", void: "VOID", cancel: "CANCELLED", delete: "—" },
  OVERDUE: { issue: "—", edit: "OVERDUE", void: "VOID", cancel: "CANCELLED", delete: "—" },
  PARTIALLY_PAID: { issue: "—", edit: "—", void: "—", cancel: "—", delete: "—" },
  PAID: { issue: "—", edit: "—", void: "—", cancel: "—", delete: "—" },
  VOID: { issue: "—", edit: "—", void: "—", cancel: "—", delete: "—" },
  CANCELLED: { issue: "—", edit: "—", void: "—", cancel: "—", delete: "—" },
};

describe("transitionInvoice", () => {
  for (const from of INVOICE_STATUSES) {
    for (const event of INVOICE_EVENTS) {
      const expected = EXPECTED[from][event];
      it(`${from} × ${event} → ${expected}`, () => {
        const result = transitionInvoice(from, event);
        if (expected === "—") expect(result).toEqual({ ok: false, from, event });
        else expect(result).toEqual({ ok: true, to: expected });
      });
    }
  }
});
