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

function view(
  taxMode: TaxMode,
  overrides: { notice?: string | null; imprint?: string | null; registration?: string | null; sales?: Parameters<typeof buildDocumentView>[0]["sales"] } = {},
) {
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
    notice: "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.",
    ...overrides,
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
    expect(v.notice).toBe("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
    expect(v.registration).toBeNull();
  });

  it("carries a registered invoice's registration line to the foot", () => {
    const v = view("inclusive", { notice: null, registration: "Acknowledgement Certificate / PTU No. 1" });
    expect(v).toMatchObject({ notice: null, registration: "Acknowledgement Certificate / PTU No. 1" });
  });

  it("carries the Stamp's imprint for a settled document, and none otherwise", () => {
    expect(view("inclusive", { imprint: "Paid" }).imprint).toBe("Paid");
    expect(view("inclusive").imprint).toBeNull();
  });

  it("prints a registered invoice's sales breakdown and marks exempt lines (B.13–B.14)", () => {
    const v = view("inclusive", {
      notice: null,
      sales: {
        rows: [{ label: "VATable Sales", amountMinor: 89286 }, { label: "VAT Amount", amountMinor: 10714 }],
        lineTax: lines.map((_, i) => (i === 0 ? null : "VAT-exempt sale")),
        statement: null,
      },
    });
    expect(v.sales).toEqual({
      rows: [
        { label: "VATable Sales", value: "₱892.86" },
        { label: "VAT Amount", value: "₱107.14" },
      ],
      statement: null,
    });
    expect(v.lines.slice(1).every((l) => l.tax === "VAT-exempt sale")).toBe(true);
    expect(v.lines[0]?.tax).toMatch(/^VAT 12/);
  });
});
