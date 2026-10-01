import { describe, expect, it } from "vitest";
import { examplePrice } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { PAYMENT_LIMITS, parsePaymentInput, type RawPayment } from "./payment-input";

const options = { currency: "PHP", locale: "en-PH", balanceMinor: 300000, today: "2026-10-01", allowWithheld: true };
const raw = (overrides: Partial<RawPayment> = {}): RawPayment => ({
  amount: "1,500",
  withheld: "",
  paidOn: "2026-10-01",
  method: "ewallet",
  reference: " GC-1234 ",
  notes: "",
  ...overrides,
});

describe("parsePaymentInput", () => {
  it("reads the amount in the invoice's currency, exactly, with the method and reference", () => {
    expect(parsePaymentInput(raw(), options)).toEqual({
      ok: true,
      payment: {
        amountMinor: 150000,
        withheldMinor: 0,
        paidOn: "2026-10-01",
        method: "ewallet",
        reference: "GC-1234",
        notes: null,
      },
    });
  });

  it("counts tax withheld toward the balance (PH Form 2307), so the invoice can close", () => {
    const result = parsePaymentInput(raw({ amount: "2,940", withheld: "60" }), options);
    expect(result.ok && result.payment).toMatchObject({ amountMinor: 294000, withheldMinor: 6000 });
  });

  it("won't take more than the balance due", () => {
    expect(parsePaymentInput(raw({ amount: "2,950", withheld: "60" }), options)).toEqual({
      ok: false,
      errors: { amount: "That's more than the balance due. Record at most the balance." },
    });
  });

  it("needs a positive amount, a real date not in the future, and a known method", () => {
    expect(parsePaymentInput(raw({ amount: "0", paidOn: "2026-10-02", method: "barter" }), options)).toEqual({
      ok: false,
      errors: {
        amount: "Enter the amount received.",
        paidOn: "The payment date can't be in the future.",
        method: "Choose how it was paid.",
      },
    });
    expect(parsePaymentInput(raw({ amount: "abc", paidOn: "2026-02-30" }), options)).toMatchObject({
      ok: false,
      errors: { amount: `Enter an amount like ${examplePrice("PHP", "en-PH")}.`, paidOn: "Enter a real date." },
    });
  });

  it("accepts a payment that's only tax withheld", () => {
    const result = parsePaymentInput(raw({ amount: "", withheld: "60" }), options);
    expect(result.ok && result.payment).toMatchObject({ amountMinor: 0, withheldMinor: 6000 });
  });

  it("ignores withheld tax where the market has none", () => {
    expect(parsePaymentInput(raw({ withheld: "60" }), { ...options, allowWithheld: false })).toMatchObject({
      ok: true,
      payment: { withheldMinor: 0 },
    });
  });

  it("limits the reference and notes", () => {
    const result = parsePaymentInput(
      raw({ reference: "x".repeat(PAYMENT_LIMITS.reference + 1), notes: "y".repeat(PAYMENT_LIMITS.notes + 1) }),
      options,
    );
    expect(result).toEqual({
      ok: false,
      errors: { reference: tooLong(PAYMENT_LIMITS.reference), notes: tooLong(PAYMENT_LIMITS.notes) },
    });
  });
});
