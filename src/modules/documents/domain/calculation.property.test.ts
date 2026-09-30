import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateDocument, type DocumentInput, type LineInput, roundDiv } from "./calculation";

// Invariants of the one calculation function (§B.2), checked over thousands
// of random documents. Ranges cover realistic small-business documents up to
// the input limits the forms allow.

const taxArb = fc.oneof(
  fc.constant(null),
  fc.record({ name: fc.constantFrom("VAT", "Local tax", "GST"), rateBps: fc.integer({ min: 0, max: 10_000 }) }),
);
const discountArb = fc.oneof(
  fc.constant(null),
  fc.record({ kind: fc.constant("percent" as const), bps: fc.integer({ min: 0, max: 10_000 }) }),
  fc.record({ kind: fc.constant("amount" as const), amountMinor: fc.integer({ min: 0, max: 10_000_000_00 }) }),
);
const lineArb: fc.Arbitrary<LineInput> = fc.record({
  unitPriceMinor: fc.integer({ min: 0, max: 1_000_000_00 }),
  quantity: fc.integer({ min: 1, max: 10_000 * 10_000 }),
  discount: discountArb,
  tax: taxArb,
});
const documentArb: fc.Arbitrary<DocumentInput> = fc.record({
  taxMode: fc.constantFrom("inclusive" as const, "exclusive" as const),
  lines: fc.array(lineArb, { maxLength: 30 }),
});

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("calculateDocument properties", () => {
  it("the total is exactly the sum of the lines the customer sees", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const doc = calculateDocument(input);
        expect(doc.totalMinor).toBe(sum(doc.lines.map((l) => l.totalMinor)));
        expect(doc.subtotalMinor).toBe(sum(doc.lines.map((l) => l.grossMinor)));
        expect(doc.discountTotalMinor).toBe(sum(doc.lines.map((l) => l.discountMinor)));
        expect(doc.taxTotalMinor).toBe(sum(doc.lines.map((l) => l.taxMinor)));
      }),
    );
  });

  it("every amount is a non-negative safe integer, and no line goes below zero", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const doc = calculateDocument(input);
        const amounts = [
          doc.subtotalMinor,
          doc.discountTotalMinor,
          doc.taxTotalMinor,
          doc.totalMinor,
          ...doc.lines.flatMap((l) => [l.grossMinor, l.discountMinor, l.netMinor, l.taxMinor, l.totalMinor]),
        ];
        for (const amount of amounts) {
          expect(Number.isSafeInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThanOrEqual(0);
        }
        for (const l of doc.lines) {
          expect(l.discountMinor).toBeLessThanOrEqual(l.grossMinor);
          expect(l.netMinor).toBe(l.grossMinor - l.discountMinor);
        }
      }),
    );
  });

  it("exclusive tax is added on top; inclusive tax is inside the price", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const doc = calculateDocument(input);
        for (const l of doc.lines) {
          if (input.taxMode === "exclusive") {
            expect(l.totalMinor).toBe(l.netMinor + l.taxMinor);
          } else {
            expect(l.totalMinor).toBe(l.netMinor);
            expect(l.taxMinor).toBeLessThanOrEqual(l.netMinor);
          }
        }
      }),
    );
  });

  it("inclusive and exclusive agree: re-adding tax to the pre-tax part lands within one minor unit", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_00 }), fc.integer({ min: 0, max: 10_000 }), (price, rateBps) => {
        const tax = { name: "VAT", rateBps };
        const inclusive = calculateDocument({
          taxMode: "inclusive",
          lines: [{ unitPriceMinor: price, quantity: 10_000, discount: null, tax }],
        }).lines[0]!;
        const base = inclusive.netMinor - inclusive.taxMinor;
        const exclusive = calculateDocument({
          taxMode: "exclusive",
          lines: [{ unitPriceMinor: base, quantity: 10_000, discount: null, tax }],
        }).lines[0]!;
        expect(Math.abs(exclusive.totalMinor - price)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("the tax breakdown adds up to the tax total, one group per name and rate", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const doc = calculateDocument(input);
        expect(sum(doc.taxes.map((t) => t.taxMinor))).toBe(doc.taxTotalMinor);
        const keys = doc.taxes.map((t) => `${t.name}|${t.rateBps}`);
        expect(new Set(keys).size).toBe(keys.length);
      }),
    );
  });

  it("the order of lines doesn't change the totals", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const reversed = calculateDocument({ ...input, lines: [...input.lines].reverse() });
        const doc = calculateDocument(input);
        expect(reversed.totalMinor).toBe(doc.totalMinor);
        expect(reversed.taxTotalMinor).toBe(doc.taxTotalMinor);
      }),
    );
  });

  it("never changes its input", () => {
    fc.assert(
      fc.property(documentArb, (input) => {
        const copy = structuredClone(input);
        calculateDocument(input);
        expect(input).toEqual(copy);
      }),
    );
  });
});

describe("roundDiv (half away from zero)", () => {
  it("matches exact rational rounding", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 24n }), fc.bigInt({ min: 1n, max: 10n ** 8n }), (n, d) => {
        const q = roundDiv(n, d);
        // q is the nearest integer to n/d: −d ≤ 2n − 2qd < d. An exact tie
        // (n/d = x.5) rounds up, away from zero, which lands on −d.
        const diff = 2n * n - 2n * q * d;
        expect(diff >= -d && diff < d).toBe(true);
      }),
    );
  });
});
