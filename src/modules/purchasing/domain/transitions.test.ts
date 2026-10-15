import { describe, expect, it } from "vitest";
import { PO_STATUSES } from "./status";
import { PO_EVENTS, transitionPurchaseOrder } from "./transitions";

describe("transitionPurchaseOrder", () => {
  it.each([
    ["DRAFT", "issue", "ISSUED"],
    ["DRAFT", "delete", "DELETED"],
    ["ISSUED", "receive", "RECEIVED"],
    ["ISSUED", "cancel", "CANCELLED"],
  ] as const)("%s + %s goes to %s", (from, event, to) => {
    expect(transitionPurchaseOrder(from, event)).toEqual({ ok: true, to });
  });

  it("refuses everything else", () => {
    const allowed = new Set(["DRAFT:issue", "DRAFT:delete", "ISSUED:receive", "ISSUED:cancel"]);
    for (const from of PO_STATUSES) {
      for (const event of PO_EVENTS) {
        if (allowed.has(`${from}:${event}`)) continue;
        expect(transitionPurchaseOrder(from, event)).toEqual({ ok: false, from, event });
      }
    }
  });
});
