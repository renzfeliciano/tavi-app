import { describe, expect, it } from "vitest";
import { tooLong } from "@/shared/validation/messages";
import { PAYMENT_LIMITS } from "./payment-input";
import { parseReceiptInput, RECEIPT_KINDS, RECEIPT_LIMITS, type RawReceipt } from "./receipt-input";

const options = { currency: "PHP", locale: "en-PH", today: "2026-10-01" };
const raw = (overrides: Partial<RawReceipt> = {}): RawReceipt => ({
  kind: "collection",
  payer: "  Maria Santos ",
  amount: "1,500",
  receivedOn: "2026-10-01",
  method: "ewallet",
  reference: " GC-1234 ",
  institution: "",
  paidTime: "",
  chequeDate: "",
  purpose: " Reimbursement of fuel ",
  notes: "",
  ...overrides,
});

describe("parseReceiptInput", () => {
  it("offers the two kinds of receipt", () => {
    expect(RECEIPT_KINDS).toEqual(["collection", "acknowledgement"]);
  });

  it("reads a receipt exactly, trimming text and leaving blank optional fields empty", () => {
    expect(parseReceiptInput(raw(), options)).toEqual({
      ok: true,
      receipt: {
        kind: "collection",
        payerName: "Maria Santos",
        amountMinor: 150000,
        receivedOn: "2026-10-01",
        method: "ewallet",
        reference: "GC-1234",
        institution: null,
        paidTime: null,
        chequeDate: null,
        purpose: "Reimbursement of fuel",
        notes: null,
      },
    });
  });

  it("refuses a kind that is not one of the two", () => {
    expect(parseReceiptInput(raw({ kind: "official" }), options)).toMatchObject({ ok: false, errors: { kind: expect.any(String) } });
  });

  it("asks for the amount when it is blank, zero or unreadable", () => {
    for (const amount of ["", "0", "abc"]) {
      expect(parseReceiptInput(raw({ amount }), options)).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
    }
  });

  it("accepts today and refuses a later date or one that is not real", () => {
    expect(parseReceiptInput(raw({ receivedOn: "2026-10-01" }), options).ok).toBe(true);
    expect(parseReceiptInput(raw({ receivedOn: "2026-10-02" }), options)).toMatchObject({ ok: false, errors: { receivedOn: expect.stringContaining("future") } });
    expect(parseReceiptInput(raw({ receivedOn: "2026-02-30" }), options)).toMatchObject({ ok: false, errors: { receivedOn: expect.any(String) } });
  });

  it("refuses a payer of only spaces, unless a default name is given", () => {
    expect(parseReceiptInput(raw({ payer: "   " }), options)).toMatchObject({ ok: false, errors: { payer: expect.any(String) } });
    const withDefault = parseReceiptInput(raw({ payer: "   " }), { ...options, defaultPayer: "Juan Dela Cruz" });
    expect(withDefault).toMatchObject({ ok: true, receipt: { payerName: "Juan Dela Cruz" } });
  });

  it("requires what the money is for", () => {
    expect(parseReceiptInput(raw({ purpose: "  " }), options)).toMatchObject({ ok: false, errors: { purpose: expect.any(String) } });
  });

  it("stops text that is too long, naming the limit", () => {
    expect(parseReceiptInput(raw({ payer: "x".repeat(RECEIPT_LIMITS.payer + 1) }), options)).toMatchObject({
      ok: false,
      errors: { payer: tooLong(RECEIPT_LIMITS.payer) },
    });
    expect(parseReceiptInput(raw({ purpose: "x".repeat(RECEIPT_LIMITS.purpose + 1) }), options)).toMatchObject({
      ok: false,
      errors: { purpose: tooLong(RECEIPT_LIMITS.purpose) },
    });
    expect(parseReceiptInput(raw({ notes: "x".repeat(RECEIPT_LIMITS.notes + 1) }), options)).toMatchObject({
      ok: false,
      errors: { notes: tooLong(RECEIPT_LIMITS.notes) },
    });
    expect(parseReceiptInput(raw({ reference: "x".repeat(PAYMENT_LIMITS.reference + 1) }), options)).toMatchObject({
      ok: false,
      errors: { reference: tooLong(PAYMENT_LIMITS.reference) },
    });
  });

  it("keeps a cheque's own date only for a cheque, and checks the time", () => {
    expect(parseReceiptInput(raw({ method: "cheque", chequeDate: "2026-11-15" }), options)).toMatchObject({
      ok: true,
      receipt: { chequeDate: "2026-11-15" },
    });
    expect(parseReceiptInput(raw({ method: "cash", chequeDate: "2026-11-15" }), options)).toMatchObject({
      ok: true,
      receipt: { chequeDate: null },
    });
    expect(parseReceiptInput(raw({ paidTime: "25:00" }), options)).toMatchObject({ ok: false, errors: { paidTime: expect.any(String) } });
  });

  it("keeps markup in a name exactly as typed (the page escapes it when drawing)", () => {
    expect(parseReceiptInput(raw({ payer: `<b>&"x"</b>` }), options)).toMatchObject({ ok: true, receipt: { payerName: `<b>&"x"</b>` } });
  });
});
