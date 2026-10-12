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
  institution: "",
  payer: "",
  paidTime: "",
  chequeDate: "",
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
        institution: null,
        payerName: null,
        paidTime: null,
        chequeDate: null,
        notes: null,
      },
    });
  });

  it("keeps the proof of payment as typed: bank or wallet, payer, and the time paid", () => {
    const result = parsePaymentInput(
      raw({ method: "bank_transfer", reference: "BDO-778812", institution: " BDO ", payer: " Maria Santos / 0012 ", paidTime: "14:30" }),
      options,
    );
    expect(result.ok && result.payment).toMatchObject({
      method: "bank_transfer",
      reference: "BDO-778812",
      institution: "BDO",
      payerName: "Maria Santos / 0012",
      paidTime: "14:30",
      chequeDate: null,
    });
  });

  it("reads a cheque: its number, its bank and the date on it (which may be post-dated)", () => {
    const result = parsePaymentInput(
      raw({ method: "cheque", reference: "0005521", institution: "Metrobank", chequeDate: "2026-11-15" }),
      options,
    );
    expect(result.ok && result.payment).toMatchObject({ reference: "0005521", institution: "Metrobank", chequeDate: "2026-11-15" });
  });

  it("only keeps a cheque date for a cheque", () => {
    const result = parsePaymentInput(raw({ method: "ewallet", chequeDate: "2026-11-15" }), options);
    expect(result.ok && result.payment.chequeDate).toBeNull();
  });

  it("reads a deposit slip's number and bank like any other reference", () => {
    const result = parsePaymentInput(raw({ method: "bank_deposit", reference: "SLIP-9981", institution: "BPI" }), options);
    expect(result.ok && result.payment).toMatchObject({ method: "bank_deposit", reference: "SLIP-9981", institution: "BPI" });
  });

  it("checks the time, the cheque date and the lengths", () => {
    expect(parsePaymentInput(raw({ paidTime: "25:00" }), options)).toMatchObject({ ok: false, errors: { paidTime: "Enter a time like 14:30." } });
    expect(parsePaymentInput(raw({ paidTime: "9:5" }), options)).toMatchObject({ ok: false, errors: { paidTime: "Enter a time like 14:30." } });
    expect(parsePaymentInput(raw({ method: "cheque", chequeDate: "2026-02-30" }), options)).toMatchObject({
      ok: false,
      errors: { chequeDate: "Enter a real date." },
    });
    expect(
      parsePaymentInput(raw({ institution: "x".repeat(PAYMENT_LIMITS.institution + 1), payer: "y".repeat(PAYMENT_LIMITS.payer + 1) }), options),
    ).toMatchObject({
      ok: false,
      errors: { institution: tooLong(PAYMENT_LIMITS.institution), payer: tooLong(PAYMENT_LIMITS.payer) },
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
