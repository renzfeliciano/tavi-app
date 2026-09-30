import { describe, expect, it } from "vitest";
import { calculateDocument, type TaxMode } from "@/modules/documents/client";
import { buildDocumentView, type DocumentViewLineInput } from "./document-view";

const VAT = { name: "VAT", rateBps: 1200 };
const lines: DocumentViewLineInput[] = [
  { description: "Aircon cleaning", quantity: 20_000, unitLabel: "unit", unitPriceMinor: 150_000, discount: null, tax: VAT },
  {
    description: "Filter",
    quantity: 10_000,
    unitLabel: "pc",
    unitPriceMinor: 50_000,
    discount: { kind: "percent", bps: 1000 },
    tax: VAT,
  },
];

function view(taxMode: TaxMode) {
  return buildDocumentView({
    title: "Quotation",
    number: null,
    revision: 1,
    business: { name: "Santos Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null },
    customer: null,
    currency: "PHP",
    locale: "en-PH",
    taxMode,
    dates: [{ label: "Date", date: "2026-10-01" }],
    lines,
    amounts: calculateDocument({ taxMode, lines: lines.map(({ unitPriceMinor, quantity, discount, tax }) => ({ unitPriceMinor, quantity, discount, tax })) }),
    notes: null,
    terms: null,
  });
}

describe("buildDocumentView", () => {
  it("lists tax as its own total row when it's added on top", () => {
    const v = view("exclusive");
    expect(v.lines[1]).toMatchObject({ quantity: "1", unit: "pc", unitPrice: "₱500.00", discount: "−10%", tax: "VAT 12%", amount: "₱450.00" });
    expect(v.totals).toEqual([
      { label: "Subtotal", value: "₱3,500.00" },
      { label: "Discount", value: "−₱50.00" },
      { label: "VAT 12%", value: "₱414.00" },
      { label: "Total", value: "₱3,864.00", emphasis: true },
    ]);
    expect(v.taxNotes).toEqual([]);
  });

  it("notes the tax inside the total when prices include it", () => {
    const v = view("inclusive");
    expect(v.totals.at(-1)).toEqual({ label: "Total", value: "₱3,450.00", emphasis: true });
    expect(v.totals.some((row) => row.label.startsWith("VAT"))).toBe(false);
    expect(v.taxNotes).toEqual(["Includes VAT 12%: ₱369.64"]);
    expect(v.dates).toEqual([{ label: "Date", value: "Oct 1, 2026" }]);
  });
});
