import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { salesBreakdown, salesBreakdownRows } from "./sales-breakdown";

// RR 7-2024 Sec. 6 B.13–B.17: how a registered invoice breaks its sales down,
// by the seller's registration. A line with a VAT rate above 0% is VATable, a
// 0% rate is zero-rated, and a line with no tax is VAT-exempt.
const labels = MARKETS.PH.invoiceRegistration.sales;

describe("salesBreakdown", () => {
  it("splits a VAT-registered seller's sales into VATable, VAT, zero-rated and exempt", () => {
    const lines = [
      { rateBps: 1200, taxMinor: 10714, totalMinor: 100000 }, // ₱1,000 VAT-inclusive
      { rateBps: 0, taxMinor: 0, totalMinor: 50000 },
      { rateBps: null, taxMinor: 0, totalMinor: 20000 },
    ];
    expect(salesBreakdown("vat", lines)).toEqual({
      kind: "vat",
      vatableMinor: 89286,
      vatMinor: 10714,
      zeroRatedMinor: 50000,
      exemptMinor: 20000,
      lines: ["vatable", "zero_rated", "exempt"],
    });
  });

  it("works the same when VAT is added on top (VATable is the total less its VAT)", () => {
    expect(salesBreakdown("vat", [{ rateBps: 1200, taxMinor: 12000, totalMinor: 112000 }])).toMatchObject({
      vatableMinor: 100000,
      vatMinor: 12000,
    });
  });

  it("shows sales subject to percentage tax for non-VAT sellers, and EXEMPT for exempt ones", () => {
    const lines = [{ rateBps: null, taxMinor: 0, totalMinor: 30000 }, { rateBps: null, taxMinor: 0, totalMinor: 5000 }];
    expect(salesBreakdown("percentage_tax", lines)).toEqual({ kind: "percentage_tax", amountMinor: 35000 });
    expect(salesBreakdown("exempt", lines)).toEqual({ kind: "exempt" });
  });
});

describe("salesBreakdownRows", () => {
  it("names the four VAT rows and marks zero-rated and exempt lines (B.13–B.14)", () => {
    const b = salesBreakdown("vat", [
      { rateBps: 1200, taxMinor: 10714, totalMinor: 100000 },
      { rateBps: 0, taxMinor: 0, totalMinor: 50000 },
      { rateBps: null, taxMinor: 0, totalMinor: 20000 },
    ]);
    expect(salesBreakdownRows(b, labels)).toEqual({
      rows: [
        { label: "VATable Sales", amountMinor: 89286 },
        { label: "VAT Amount", amountMinor: 10714 },
        { label: "Zero-Rated Sales", amountMinor: 50000 },
        { label: "VAT-Exempt Sales", amountMinor: 20000 },
      ],
      lineTax: [null, "Zero-rated sale", "VAT-exempt sale"],
      statement: null,
    });
  });

  it("prints the percentage-tax row (B.17) or the word EXEMPT (B.16)", () => {
    expect(salesBreakdownRows({ kind: "percentage_tax", amountMinor: 35000 }, labels)).toEqual({
      rows: [{ label: "Sales Subject to Percentage Tax", amountMinor: 35000 }],
      lineTax: [],
      statement: null,
    });
    expect(salesBreakdownRows({ kind: "exempt" }, labels)).toEqual({ rows: [], lineTax: [], statement: "EXEMPT" });
  });
});
