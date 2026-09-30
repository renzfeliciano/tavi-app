import { describe, expect, it } from "vitest";
import { QUOTE_STATUSES, type QuoteStatus } from "./status";
import { QUOTE_EVENTS, type QuoteEvent, transitionQuote } from "./transitions";

// Every status × every event (§B.3). "—" means the event isn't allowed there.
// Written out in full on purpose: changing a rule means changing this table.
const EXPECTED: Record<QuoteStatus, Record<QuoteEvent, QuoteStatus | "DELETED" | "—">> = {
  DRAFT: {
    send: "SENT",
    view: "—",
    approve: "—",
    reject: "—",
    expire: "—",
    revise: "—",
    cancel: "CANCELLED",
    delete: "DELETED",
    convert: "—",
  },
  SENT: {
    send: "—",
    view: "VIEWED",
    approve: "APPROVED",
    reject: "REJECTED",
    expire: "EXPIRED",
    revise: "DRAFT",
    cancel: "CANCELLED",
    delete: "—",
    convert: "—",
  },
  VIEWED: {
    send: "—",
    view: "VIEWED",
    approve: "APPROVED",
    reject: "REJECTED",
    expire: "EXPIRED",
    revise: "DRAFT",
    cancel: "CANCELLED",
    delete: "—",
    convert: "—",
  },
  APPROVED: {
    send: "—",
    view: "APPROVED",
    approve: "—",
    reject: "—",
    expire: "—",
    revise: "—",
    cancel: "CANCELLED",
    delete: "—",
    convert: "APPROVED",
  },
  REJECTED: {
    send: "—",
    view: "REJECTED",
    approve: "—",
    reject: "—",
    expire: "—",
    revise: "DRAFT",
    cancel: "—",
    delete: "—",
    convert: "—",
  },
  EXPIRED: {
    send: "—",
    view: "EXPIRED",
    approve: "—",
    reject: "—",
    expire: "—",
    revise: "DRAFT",
    cancel: "CANCELLED",
    delete: "—",
    convert: "—",
  },
  CANCELLED: {
    send: "—",
    view: "CANCELLED",
    approve: "—",
    reject: "—",
    expire: "—",
    revise: "—",
    cancel: "—",
    delete: "—",
    convert: "—",
  },
};

describe("transitionQuote", () => {
  it("covers every status and event", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...QUOTE_STATUSES].sort());
    for (const status of QUOTE_STATUSES) {
      expect(Object.keys(EXPECTED[status]).sort()).toEqual([...QUOTE_EVENTS].sort());
    }
  });

  for (const status of QUOTE_STATUSES) {
    for (const event of QUOTE_EVENTS) {
      const expected = EXPECTED[status][event];
      it(`${status} + ${event} → ${expected}`, () => {
        expect(transitionQuote(status, event)).toEqual(
          expected === "—" ? { ok: false, from: status, event } : { ok: true, to: expected },
        );
      });
    }
  }
});
