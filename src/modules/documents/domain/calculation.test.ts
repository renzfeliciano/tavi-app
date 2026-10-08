import { describe, expect, it } from "vitest";
import { calculateDocument, type LineInput } from "./calculation";
import { QUANTITY_SCALE } from "./quantity";

const VAT = { name: "VAT", rateBps: 1200 };
const qty = (n: number) => Math.round(n * QUANTITY_SCALE);
const line = (overrides: Partial<LineInput> = {}): LineInput => ({
  unitPriceMinor: 100_000,
  quantity: qty(1),
  discount: null,
  tax: null,
  ...overrides,
});

describe("calculateDocument: one line", () => {
  it("adds tax on top in exclusive mode", () => {
    const doc = calculateDocument({ taxMode: "exclusive", lines: [line({ quantity: qty(2), tax: VAT })] });

    expect(doc.lines[0]).toEqual({ grossMinor: 200_000, discountMinor: 0, netMinor: 200_000, taxMinor: 24_000, totalMinor: 224_000, qualifiedDiscountMinor: 0, taxWaivedMinor: 0 });
    expect(doc).toMatchObject({ subtotalMinor: 200_000, discountTotalMinor: 0, taxTotalMinor: 24_000, totalMinor: 224_000 });
  });

  it("finds the tax already inside the price in inclusive mode", () => {
    const doc = calculateDocument({ taxMode: "inclusive", lines: [line({ unitPriceMinor: 112_000, tax: VAT })] });

    // 1,120.00 = 1,000.00 + 120.00 VAT; the customer pays the price as quoted.
    expect(doc.lines[0]).toEqual({ grossMinor: 112_000, discountMinor: 0, netMinor: 112_000, taxMinor: 12_000, totalMinor: 112_000, qualifiedDiscountMinor: 0, taxWaivedMinor: 0 });
    expect(doc.taxes).toEqual([{ name: "VAT", rateBps: 1200, taxableMinor: 100_000, taxMinor: 12_000 }]);
  });

  it("rounds each line half away from zero", () => {
    // 0.05 × 1.5 = 0.075 → 0.08; 12% of 0.08 = 0.0096 → 0.01.
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [line({ unitPriceMinor: 5, quantity: qty(1.5), tax: VAT })],
    });
    expect(doc.lines[0]).toMatchObject({ grossMinor: 8, taxMinor: 1, totalMinor: 9 });
  });

  it("rounds inclusive tax the same way", () => {
    // 1.00 incl. 12%: 1.00 / 1.12 = 0.892857… → 0.89 before tax, so 0.11 tax.
    const doc = calculateDocument({ taxMode: "inclusive", lines: [line({ unitPriceMinor: 100, tax: VAT })] });
    expect(doc.lines[0]).toMatchObject({ taxMinor: 11, totalMinor: 100 });
  });

  it("takes a percentage discount before tax, rounding the discount", () => {
    // 10% of 123.45 = 12.345 → 12.35 off; 111.10 net; 12% = 13.332 → 13.33.
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [line({ unitPriceMinor: 12_345, discount: { kind: "percent", bps: 1000 }, tax: VAT })],
    });
    expect(doc.lines[0]).toEqual({ grossMinor: 12_345, discountMinor: 1235, netMinor: 11_110, taxMinor: 1333, totalMinor: 12_443, qualifiedDiscountMinor: 0, taxWaivedMinor: 0 });
  });

  it("never lets a fixed discount exceed the line", () => {
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [line({ unitPriceMinor: 30_000, discount: { kind: "amount", amountMinor: 50_000 }, tax: VAT })],
    });
    expect(doc.lines[0]).toEqual({ grossMinor: 30_000, discountMinor: 30_000, netMinor: 0, taxMinor: 0, totalMinor: 0, qualifiedDiscountMinor: 0, taxWaivedMinor: 0 });
  });

  it("handles the smallest quantity", () => {
    const doc = calculateDocument({ taxMode: "exclusive", lines: [line({ unitPriceMinor: 1, quantity: 1 })] });
    expect(doc.lines[0]).toMatchObject({ grossMinor: 0, totalMinor: 0 });
  });

  it("stays exact for large amounts that would overflow a float product", () => {
    // 999,999,999,999.99 × 999,999.9999 needs more than 53 bits along the way.
    expect(() =>
      calculateDocument({
        taxMode: "exclusive",
        lines: [line({ unitPriceMinor: 99_999_999_999_999, quantity: 9_999_999_999 })],
      }),
    ).toThrow(RangeError);
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [line({ unitPriceMinor: 12_345_678_901, quantity: qty(3.3333) })],
    });
    // 123,456,789.01 × 3.3333 = 411,518,514.807033 → 411,518,514.81 (checked with exact fractions)
    expect(doc.lines[0]?.grossMinor).toBe(41_151_851_481);
  });
});

describe("calculateDocument: many lines", () => {
  it("sums the lines, and groups tax by rate in order of first use", () => {
    const localTax = { name: "Local tax", rateBps: 300 };
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [
        line({ unitPriceMinor: 100_000, tax: VAT }),
        line({ unitPriceMinor: 50_000, tax: localTax }),
        line({ unitPriceMinor: 20_000, tax: VAT }),
        line({ unitPriceMinor: 5_000 }),
      ],
    });

    expect(doc).toMatchObject({
      subtotalMinor: 175_000,
      discountTotalMinor: 0,
      taxTotalMinor: 12_000 + 1_500 + 2_400,
      totalMinor: 175_000 + 15_900,
    });
    expect(doc.taxes).toEqual([
      { name: "VAT", rateBps: 1200, taxableMinor: 120_000, taxMinor: 14_400 },
      { name: "Local tax", rateBps: 300, taxableMinor: 50_000, taxMinor: 1_500 },
    ]);
  });

  it("keeps two taxes with the same name but different rates apart", () => {
    const doc = calculateDocument({
      taxMode: "exclusive",
      lines: [line({ tax: VAT }), line({ tax: { name: "VAT", rateBps: 500 } })],
    });
    expect(doc.taxes.map((t) => t.rateBps)).toEqual([1200, 500]);
  });

  it("totals an empty document as zero", () => {
    expect(calculateDocument({ taxMode: "inclusive", lines: [] })).toEqual({
      lines: [],
      subtotalMinor: 0,
      discountTotalMinor: 0,
      taxTotalMinor: 0,
      totalMinor: 0,
      qualifiedDiscountTotalMinor: 0,
      taxWaivedTotalMinor: 0,
      taxes: [],
    });
  });
});

describe("calculateDocument: refuses impossible input", () => {
  it.each<[string, Partial<LineInput>]>([
    ["a negative price", { unitPriceMinor: -1 }],
    ["a fractional price", { unitPriceMinor: 1.5 }],
    ["a zero quantity", { quantity: 0 }],
    ["a fractional scaled quantity", { quantity: 1.5 }],
    ["a discount over 100%", { discount: { kind: "percent", bps: 10_001 } }],
    ["a negative fixed discount", { discount: { kind: "amount", amountMinor: -5 } }],
    ["a tax over 100%", { tax: { name: "VAT", rateBps: 10_001 } }],
  ])("%s", (_label, overrides) => {
    expect(() => calculateDocument({ taxMode: "exclusive", lines: [line(overrides)] })).toThrow(RangeError);
  });
});

// Qualified discounts (PH: senior citizens, PWDs, solo parents, national
// athletes and coaches, Medal of Valor awardees; RR 7-2024 Sec. 6 B.18, D19).
// The discount is taken on the price before VAT. Where the law also exempts
// the sale from VAT (senior citizens, PWDs, solo parents), the VAT is waived;
// otherwise VAT stays on the undiscounted price (RR 13-2020 for athletes).
describe("calculateDocument: qualified discounts", () => {
  const SC = { rateBps: 2000, taxExempt: true };
  const NAAC = { rateBps: 2000, taxExempt: false };

  it("a VAT-exempt 20% discount on a VAT-inclusive price: 1,120.00 → 1,000.00 − 200.00 = 800.00", () => {
    const doc = calculateDocument({ taxMode: "inclusive", qualifiedDiscount: SC, lines: [line({ unitPriceMinor: 112_000, tax: VAT })] });
    expect(doc.lines[0]).toEqual({
      grossMinor: 112_000,
      discountMinor: 0,
      netMinor: 112_000,
      taxMinor: 0,
      totalMinor: 80_000,
      qualifiedDiscountMinor: 20_000,
      taxWaivedMinor: 12_000,
    });
    expect(doc).toMatchObject({ taxTotalMinor: 0, totalMinor: 80_000, qualifiedDiscountTotalMinor: 20_000, taxWaivedTotalMinor: 12_000 });
    // A VAT-exempt sale carries no VAT, so it's in no tax group.
    expect(doc.taxes).toEqual([]);
  });

  it("a discount without VAT exemption keeps VAT on the undiscounted price: 1,120.00 − 200.00 = 920.00", () => {
    const doc = calculateDocument({ taxMode: "inclusive", qualifiedDiscount: NAAC, lines: [line({ unitPriceMinor: 112_000, tax: VAT })] });
    expect(doc.lines[0]).toMatchObject({ taxMinor: 12_000, totalMinor: 92_000, qualifiedDiscountMinor: 20_000, taxWaivedMinor: 0 });
    expect(doc.taxes).toEqual([{ name: "VAT", rateBps: 1200, taxableMinor: 100_000, taxMinor: 12_000 }]);
  });

  it("works the same on tax-exclusive prices", () => {
    const exempt = calculateDocument({ taxMode: "exclusive", qualifiedDiscount: SC, lines: [line({ tax: VAT })] });
    expect(exempt.lines[0]).toMatchObject({ netMinor: 100_000, taxMinor: 0, totalMinor: 80_000, qualifiedDiscountMinor: 20_000, taxWaivedMinor: 12_000 });
    const taxed = calculateDocument({ taxMode: "exclusive", qualifiedDiscount: NAAC, lines: [line({ tax: VAT })] });
    expect(taxed.lines[0]).toMatchObject({ taxMinor: 12_000, totalMinor: 92_000, qualifiedDiscountMinor: 20_000, taxWaivedMinor: 0 });
  });

  it("takes the discount on the whole price when there's no VAT on the line", () => {
    const doc = calculateDocument({
      taxMode: "inclusive",
      qualifiedDiscount: { rateBps: 1000, taxExempt: true },
      lines: [line({ unitPriceMinor: 50_000 }), line({ unitPriceMinor: 30_000, tax: { name: "VAT", rateBps: 0 } })],
    });
    expect(doc.lines.map((l) => [l.qualifiedDiscountMinor, l.taxWaivedMinor, l.totalMinor])).toEqual([
      [5_000, 0, 45_000],
      [3_000, 0, 27_000],
    ]);
  });

  it("rounds per line, half away from zero", () => {
    // 333.33 incl. 12%: 333.33 / 1.12 = 297.616… → 297.62 before VAT (3.71 waived); 20% = 59.524 → 59.52; due 238.10.
    const doc = calculateDocument({ taxMode: "inclusive", qualifiedDiscount: SC, lines: [line({ unitPriceMinor: 33_333, tax: VAT })] });
    expect(doc.lines[0]).toMatchObject({ taxWaivedMinor: 3_571, qualifiedDiscountMinor: 5_952, totalMinor: 23_810 });
  });

  it("sums the discount and waived VAT over the lines", () => {
    const doc = calculateDocument({
      taxMode: "inclusive",
      qualifiedDiscount: SC,
      lines: [line({ unitPriceMinor: 112_000, tax: VAT }), line({ unitPriceMinor: 56_000, quantity: qty(2), tax: VAT })],
    });
    expect(doc).toMatchObject({ subtotalMinor: 224_000, qualifiedDiscountTotalMinor: 40_000, taxWaivedTotalMinor: 24_000, totalMinor: 160_000 });
  });

  it("refuses a rate outside 0–100%", () => {
    for (const rateBps of [-1, 10_001, 12.5]) {
      expect(() => calculateDocument({ taxMode: "inclusive", qualifiedDiscount: { rateBps, taxExempt: true }, lines: [line()] })).toThrow(RangeError);
    }
  });
});
