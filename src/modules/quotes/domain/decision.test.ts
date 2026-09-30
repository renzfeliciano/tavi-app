import { describe, expect, it } from "vitest";
import { tooLong } from "@/shared/validation/messages";
import { canonicalQuoteContent, parseQuoteDecision, QUOTE_DECISION_LIMITS, quoteDecisionCheck } from "./decision";

describe("parseQuoteDecision", () => {
  it("accepts an approval with a name and the terms accepted", () => {
    expect(parseQuoteDecision({ kind: "approve", name: "  Juan Dela Cruz ", accepted: true })).toEqual({
      ok: true,
      decision: { kind: "approve", name: "Juan Dela Cruz" },
    });
  });

  it("asks for the approver's name and the terms checkbox", () => {
    expect(parseQuoteDecision({ kind: "approve", name: " ", accepted: false })).toEqual({
      ok: false,
      errors: { name: "Enter your name.", accepted: "Tick the box to accept the quote's terms." },
    });
  });

  it("limits the name to its maximum length", () => {
    const result = parseQuoteDecision({ kind: "approve", name: "x".repeat(QUOTE_DECISION_LIMITS.name + 1), accepted: true });
    expect(result).toEqual({ ok: false, errors: { name: tooLong(QUOTE_DECISION_LIMITS.name) } });
  });

  it("accepts a decline with or without a reason", () => {
    expect(parseQuoteDecision({ kind: "reject", reason: "  " })).toEqual({
      ok: true,
      decision: { kind: "reject", reason: null },
    });
    expect(parseQuoteDecision({ kind: "reject", reason: " Too expensive " })).toEqual({
      ok: true,
      decision: { kind: "reject", reason: "Too expensive" },
    });
  });

  it("limits the reason to its maximum length", () => {
    const result = parseQuoteDecision({ kind: "reject", reason: "x".repeat(QUOTE_DECISION_LIMITS.reason + 1) });
    expect(result).toEqual({ ok: false, errors: { reason: tooLong(QUOTE_DECISION_LIMITS.reason) } });
  });
});

describe("quoteDecisionCheck", () => {
  const today = "2026-10-01";

  it("lets the customer decide a sent or viewed quote up to its last valid day", () => {
    expect(quoteDecisionCheck({ status: "SENT", validUntil: today }, "approve", today)).toEqual({ ok: true });
    expect(quoteDecisionCheck({ status: "VIEWED", validUntil: "2026-10-05" }, "reject", today)).toEqual({ ok: true });
  });

  it("expires an open quote whose valid-until date has passed, even before the daily job", () => {
    expect(quoteDecisionCheck({ status: "VIEWED", validUntil: "2026-09-30" }, "approve", today)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a quote that is already decided, expired or cancelled", () => {
    for (const status of ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "DRAFT"] as const) {
      expect(quoteDecisionCheck({ status, validUntil: "2026-10-05" }, "approve", today)).toEqual({
        ok: false,
        reason: "closed",
      });
    }
  });
});

describe("canonicalQuoteContent", () => {
  const content = {
    number: "QUO-000001",
    revision: 1,
    currency: "PHP",
    validUntil: "2026-10-15",
    totalMinor: 150000,
    lines: [{ description: "Cleaning", totalMinor: 150000 }],
  };

  it("is the same for the same content, whatever the key order", () => {
    const reordered = { totalMinor: 150000, lines: [{ totalMinor: 150000, description: "Cleaning" }], validUntil: "2026-10-15", currency: "PHP", revision: 1, number: "QUO-000001" };
    expect(canonicalQuoteContent(reordered)).toBe(canonicalQuoteContent(content));
  });

  it("changes when anything the customer saw changes", () => {
    expect(canonicalQuoteContent({ ...content, totalMinor: 150001 })).not.toBe(canonicalQuoteContent(content));
    expect(canonicalQuoteContent({ ...content, revision: 2 })).not.toBe(canonicalQuoteContent(content));
  });
});
