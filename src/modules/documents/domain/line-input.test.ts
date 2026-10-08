import { describe, expect, it } from "vitest";
import { blankLine, DOCUMENT_LIMITS, parseDocumentLines, type RawLine } from "./line-input";

const opts = { currency: "PHP", locale: "en-PH" };
const raw = (overrides: Partial<RawLine> = {}): RawLine => ({
  ...blankLine(),
  description: "Aircon cleaning",
  quantity: "1",
  unitLabel: "unit",
  unitPrice: "1,500",
  ...overrides,
});

describe("parseDocumentLines", () => {
  it("reads typed lines into exact values", () => {
    const result = parseDocumentLines(
      [
        raw({ quantity: "1.5", unitPrice: "1,250.50", discountKind: "percent", discountValue: "10" }),
        raw({
          description: "Filter",
          discountKind: "amount",
          discountValue: "50",
          taxRateId: "01890000-0000-7000-8000-000000000000",
          sourceKind: "product",
          sourceId: "01890000-0000-7000-8000-000000000001",
        }),
      ],
      opts,
    );

    expect(result).toEqual({
      ok: true,
      lines: [
        {
          description: "Aircon cleaning",
          quantity: 15_000,
          unitLabel: "unit",
          unitPriceMinor: 125_050,
          discount: { kind: "percent", bps: 1000 },
          taxRateId: null,
          source: null,
        },
        {
          description: "Filter",
          quantity: 10_000,
          unitLabel: "unit",
          unitPriceMinor: 150_000,
          discount: { kind: "amount", amountMinor: 5000 },
          taxRateId: "01890000-0000-7000-8000-000000000000",
          source: { kind: "product", id: "01890000-0000-7000-8000-000000000001" },
        },
      ],
    });
  });

  it("skips lines left completely blank", () => {
    const result = parseDocumentLines([raw(), blankLine(), raw({ description: "Filter" })], opts);
    expect(result.ok && result.lines.map((l) => l.description)).toEqual(["Aircon cleaning", "Filter"]);
  });

  it("explains each problem by line and field, with examples in the business's format", () => {
    const result = parseDocumentLines(
      [
        raw(),
        raw({ description: "", quantity: "0", unitLabel: " ", unitPrice: "12.345" }),
        raw({ discountKind: "percent", discountValue: "150", taxRateId: "nope" }),
        raw({ discountKind: "amount", discountValue: "abc" }),
      ],
      opts,
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        "lines.1.description": "Describe this line.",
        "lines.1.quantity": "Enter a quantity like 1.5.",
        "lines.1.unitLabel": "Enter a unit.",
        "lines.1.unitPrice": "Enter a price like 1,250.50.",
        "lines.2.discountValue": "Enter a discount from 0 to 100%.",
        "lines.2.taxRateId": "Choose a tax rate from the list.",
        "lines.3.discountValue": "Enter a discount like 1,250.50.",
      },
    });
  });

  it("takes only the market's units when given its list", () => {
    const units = ["hour", "unit", "sq m"];
    const result = parseDocumentLines(
      [raw({ unitLabel: "sq m" }), raw({ unitLabel: "hrs" }), raw({ unitLabel: " " }), raw({ unitLabel: "Unit" })],
      { ...opts, units },
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        "lines.1.unitLabel": "Choose a unit from the list.",
        "lines.2.unitLabel": "Choose a unit.",
        "lines.3.unitLabel": "Choose a unit from the list.",
      },
    });
    expect(parseDocumentLines([raw({ unitLabel: " hour " })], { ...opts, units })).toEqual({
      ok: true,
      lines: [expect.objectContaining({ unitLabel: "hour" })],
    });
  });

  it("uses the currency's decimals and the locale's separators", () => {
    const yen = parseDocumentLines([raw({ unitPrice: "1.250", quantity: "2,5" })], { currency: "JPY", locale: "de-DE" });
    expect(yen).toEqual({ ok: true, lines: [expect.objectContaining({ unitPriceMinor: 1250, quantity: 25_000 })] });
  });

  it("refuses a line too large to calculate exactly", () => {
    const result = parseDocumentLines([raw({ unitPrice: "999,999,999,999", quantity: "999,999" })], opts);
    expect(result).toEqual({ ok: false, errors: { "lines.0.unitPrice": "This line is too large. Split it into smaller lines." } });
  });

  it("caps the number of lines", () => {
    const lines = Array.from({ length: DOCUMENT_LIMITS.lines + 1 }, () => raw());
    expect(parseDocumentLines(lines, opts)).toEqual({
      ok: false,
      errors: { lines: `Use up to ${DOCUMENT_LIMITS.lines} lines.` },
    });
  });
});
