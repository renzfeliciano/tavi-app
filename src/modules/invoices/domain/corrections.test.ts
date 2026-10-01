import { describe, expect, it } from "vitest";
import { tooLong } from "@/shared/validation/messages";
import { INVOICE_REASON_MAX, issuedEditProblems, parseInvoiceReason } from "./corrections";

describe("parseInvoiceReason", () => {
  it("needs a reason, trimmed", () => {
    expect(parseInvoiceReason("  Wrong customer ")).toEqual({ ok: true, reason: "Wrong customer" });
    expect(parseInvoiceReason("   ")).toEqual({ ok: false, error: "Give a reason. It's kept with the record." });
  });

  it("limits its length", () => {
    expect(parseInvoiceReason("x".repeat(INVOICE_REASON_MAX + 1))).toEqual({
      ok: false,
      error: tooLong(INVOICE_REASON_MAX),
    });
  });
});

describe("issuedEditProblems", () => {
  const current = { customerId: "c1", currency: "PHP", amountPaidMinor: 0 };

  it("allows changing lines, dates, notes and terms of an unpaid invoice", () => {
    expect(issuedEditProblems(current, { customerId: "c1", currency: "PHP", lineCount: 2 })).toEqual({});
  });

  it("keeps the customer and currency, and needs an item", () => {
    expect(issuedEditProblems(current, { customerId: "c2", currency: "USD", lineCount: 0 })).toEqual({
      customerId: "The customer can't change once sent. Void this one and create a new one instead.",
      currency: "The currency can't change once sent. Void this one and create a new one instead.",
      lines: "Keep at least one item.",
    });
  });

  it("locks once anything is paid (D7)", () => {
    expect(issuedEditProblems({ ...current, amountPaidMinor: 100 }, { customerId: "c1", currency: "PHP", lineCount: 1 })).toEqual({
      form: "A payment is recorded, so this can't be edited. Void the payment first, or use void & duplicate.",
    });
  });
});
