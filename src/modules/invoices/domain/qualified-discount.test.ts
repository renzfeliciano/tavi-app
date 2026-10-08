import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { calculateDocument } from "@/modules/documents/client";
import {
  parseQualifiedDiscount,
  QUALIFIED_DISCOUNT_LIMITS,
  qualifiedDiscountInput,
  qualifiedDiscountRows,
  toRawQualifiedDiscount,
} from "./qualified-discount";

const config = MARKETS.PH.qualifiedDiscounts;
const parse = (raw: unknown, hasLineDiscounts = false) => parseQualifiedDiscount(raw, config, { hasLineDiscounts });

describe("parseQualifiedDiscount (RR 7-2024 Sec. 6 B.18, D19)", () => {
  it("means no discount when no kind is chosen", () => {
    expect(parse({ kind: "", idNumber: "", holderName: "" })).toEqual({ ok: true, discount: null });
    expect(parse(undefined)).toEqual({ ok: true, discount: null });
    expect(parse("garbage")).toEqual({ ok: true, discount: null });
  });

  it("snapshots the kind's rate and tax treatment with the buyer's ID and name", () => {
    expect(parse({ kind: "senior_citizen", idNumber: " 12345 ", holderName: " Lola Remedios " })).toEqual({
      ok: true,
      discount: {
        kind: "senior_citizen",
        label: "Senior citizen",
        idLabel: "OSCA / SC ID No.",
        idNumber: "12345",
        holderName: "Lola Remedios",
        rateBps: 2000,
        taxExempt: true,
      },
    });
    expect(parse({ kind: "solo_parent", idNumber: "SP-1", holderName: "Ana" })).toMatchObject({ discount: { rateBps: 1000, taxExempt: true } });
    expect(parse({ kind: "naac", idNumber: "N-1", holderName: "Ben" })).toMatchObject({ discount: { rateBps: 2000, taxExempt: false } });
  });

  it("needs a known kind, the ID number and the name", () => {
    expect(parse({ kind: "student", idNumber: "1", holderName: "A" })).toEqual({
      ok: false,
      errors: { "qualifiedDiscount.kind": "Choose a discount from the list." },
    });
    expect(parse({ kind: "pwd", idNumber: " ", holderName: "" })).toEqual({
      ok: false,
      errors: { "qualifiedDiscount.idNumber": "Enter the PWD ID No.", "qualifiedDiscount.holderName": "Enter the name on the ID." },
    });
    const long = parse({ kind: "pwd", idNumber: "9".repeat(QUALIFIED_DISCOUNT_LIMITS.idNumber + 1), holderName: "x".repeat(QUALIFIED_DISCOUNT_LIMITS.holderName + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(Object.keys(long.errors)).toEqual(["qualifiedDiscount.idNumber", "qualifiedDiscount.holderName"]);
  });

  it("refuses to combine with item discounts: the law gives one or the other", () => {
    expect(parse({ kind: "senior_citizen", idNumber: "1", holderName: "A" }, true)).toEqual({
      ok: false,
      errors: { "qualifiedDiscount.kind": config!.notWithLineDiscounts },
    });
  });

  it("is refused in a market without qualified discounts", () => {
    expect(parseQualifiedDiscount({ kind: "senior_citizen", idNumber: "1", holderName: "A" }, null, { hasLineDiscounts: false })).toMatchObject({ ok: false });
  });
});

describe("qualifiedDiscountRows", () => {
  it("prints the breakdown the way the regulation asks, adding up to the total due", () => {
    const amounts = calculateDocument({
      taxMode: "inclusive",
      qualifiedDiscount: { rateBps: 2000, taxExempt: true },
      lines: [{ unitPriceMinor: 112_000, quantity: 10_000, discount: null, tax: { name: "VAT", rateBps: 1200 } }],
    });
    expect(qualifiedDiscountRows(amounts, { label: "Senior citizen" }, config!.rows, "20%")).toEqual([
      { label: "Total Sales (VAT Inclusive)", amountMinor: 112_000 },
      { label: "Less: VAT", amountMinor: 12_000, deduction: true },
      { label: "Amount Net of VAT", amountMinor: 100_000 },
      { label: "Less: Senior citizen discount (20%)", amountMinor: 20_000, deduction: true },
      { label: "Add: VAT", amountMinor: 0 },
      { label: "Total Amount Due", amountMinor: 80_000, emphasis: true },
    ]);
  });

  it("adds the VAT back when the discount isn't tax-exempt", () => {
    const amounts = calculateDocument({
      taxMode: "exclusive",
      qualifiedDiscount: { rateBps: 2000, taxExempt: false },
      lines: [{ unitPriceMinor: 100_000, quantity: 10_000, discount: null, tax: { name: "VAT", rateBps: 1200 } }],
    });
    const rows = qualifiedDiscountRows(amounts, { label: "National athlete or coach" }, config!.rows, "20%");
    expect(rows.map((r) => r.amountMinor)).toEqual([112_000, 12_000, 100_000, 20_000, 12_000, 92_000]);
  });
});

describe("conversions", () => {
  it("round-trips between the editor and the snapshot", () => {
    const parsed = parse({ kind: "pwd", idNumber: "P-1", holderName: "Carlo" });
    if (!parsed.ok || !parsed.discount) throw new Error("parse");
    expect(toRawQualifiedDiscount(parsed.discount)).toEqual({ kind: "pwd", idNumber: "P-1", holderName: "Carlo" });
    expect(toRawQualifiedDiscount(null)).toEqual({ kind: "", idNumber: "", holderName: "" });
    expect(qualifiedDiscountInput(parsed.discount)).toEqual({ rateBps: 2000, taxExempt: true });
    expect(qualifiedDiscountInput(null)).toBeNull();
  });
});
