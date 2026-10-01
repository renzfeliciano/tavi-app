import type { MarketProfile } from "@/config/markets";

// The sales breakdown on a registered invoice (RR 7-2024 Sec. 6 B.13–B.17),
// by how the seller is registered for tax. TAVI's convention, stated in the
// tax-rates settings: a VAT rate above 0% is VATable, a 0% rate marks a
// zero-rated sale, and a line with no tax is a VAT-exempt sale. Computed once
// at issue from the engine's line amounts and kept with the invoice.

export type SaleCategory = "vatable" | "zero_rated" | "exempt";
export type SellerSales = "vat" | "percentage_tax" | "exempt";

export type SalesBreakdown =
  | { kind: "vat"; vatableMinor: number; vatMinor: number; zeroRatedMinor: number; exemptMinor: number; lines: SaleCategory[] }
  | { kind: "percentage_tax"; amountMinor: number }
  | { kind: "exempt" };

type Line = { rateBps: number | null; taxMinor: number; totalMinor: number };

const categoryOf = (line: Line): SaleCategory =>
  line.rateBps === null ? "exempt" : line.rateBps > 0 ? "vatable" : "zero_rated";

export function salesBreakdown(seller: SellerSales, lines: Line[]): SalesBreakdown {
  if (seller === "exempt") return { kind: "exempt" };
  if (seller === "percentage_tax") return { kind: "percentage_tax", amountMinor: lines.reduce((sum, l) => sum + l.totalMinor, 0) };
  const breakdown = { kind: "vat" as const, vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 0, exemptMinor: 0, lines: [] as SaleCategory[] };
  for (const line of lines) {
    const category = categoryOf(line);
    breakdown.lines.push(category);
    if (category === "vatable") {
      // In both tax modes the line total includes its VAT; VATable sales exclude it.
      breakdown.vatableMinor += line.totalMinor - line.taxMinor;
      breakdown.vatMinor += line.taxMinor;
    } else if (category === "zero_rated") breakdown.zeroRatedMinor += line.totalMinor;
    else breakdown.exemptMinor += line.totalMinor;
  }
  return breakdown;
}

type Labels = NonNullable<MarketProfile["invoiceRegistration"]>["sales"];

/** The breakdown as printed: summary rows, per-line tax wording (B.14) and the seller's statement (B.16). */
export function salesBreakdownRows(
  breakdown: SalesBreakdown,
  labels: Labels,
): { rows: { label: string; amountMinor: number }[]; lineTax: (string | null)[]; statement: string | null } {
  if (breakdown.kind === "exempt") return { rows: [], lineTax: [], statement: labels.exemptSeller };
  if (breakdown.kind === "percentage_tax") {
    return { rows: [{ label: labels.percentageTax, amountMinor: breakdown.amountMinor }], lineTax: [], statement: null };
  }
  return {
    rows: [
      { label: labels.vatable, amountMinor: breakdown.vatableMinor },
      { label: labels.vat, amountMinor: breakdown.vatMinor },
      { label: labels.zeroRated, amountMinor: breakdown.zeroRatedMinor },
      { label: labels.exempt, amountMinor: breakdown.exemptMinor },
    ],
    lineTax: breakdown.lines.map((c) => (c === "zero_rated" ? labels.zeroRatedLine : c === "exempt" ? labels.exemptLine : null)),
    statement: null,
  };
}
