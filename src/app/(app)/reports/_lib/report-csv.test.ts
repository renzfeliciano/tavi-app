import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { PaymentRow, SalesRow, UnpaidRow } from "@/modules/reports";
import type { WithholdingCsvRow } from "@/modules/payments";
import { paymentsCsv, salesCsv, unpaidCsv, withholdingCsv } from "./report-csv";

const market = MARKETS.PH;
const lines = (csv: string) => csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");

const sale: SalesRow = {
  id: "i1",
  number: "INV-000001",
  title: "Billing statement",
  registered: false,
  issueDate: "2026-09-05",
  dueDate: "2026-09-20",
  status: "PARTIALLY_PAID",
  cancelled: false,
  customerId: "c1",
  customerName: "Santos, Juan",
  customerTaxId: "123-456-789-00000",
  currency: "PHP",
  totalMinor: 112_000,
  taxMinor: 12_000,
  paidMinor: 50_000,
  vatableMinor: 100_000,
  vatMinor: 12_000,
  zeroRatedMinor: 0,
  exemptMinor: 0,
  qualifiedDiscountMinor: 0,
};

describe("salesCsv", () => {
  it("writes one row per bill, money as exact decimals, with the VAT columns for VAT sellers", () => {
    expect(lines(salesCsv([sale], market, "vat"))).toEqual([
      "Date issued,Number,Document,Customer,Customer TIN,Status,Currency,Before tax,Tax,Total,Paid,Balance,VATable Sales,VAT Amount,Zero-Rated Sales,VAT-Exempt Sales,Special discount",
      '2026-09-05,INV-000001,Billing statement,"Santos, Juan",123-456-789-00000,Partially paid,PHP,1000.00,120.00,1120.00,500.00,620.00,1000.00,120.00,0.00,0.00,0.00',
    ]);
  });

  it("leaves the VAT columns out for other sellers, and a cancelled bill owes nothing", () => {
    const [header, row] = lines(salesCsv([{ ...sale, status: "CANCELLED", cancelled: true, paidMinor: 0 }], market, "percentage_tax"));
    expect(header?.endsWith("Paid,Balance,Special discount")).toBe(true);
    expect(row?.endsWith("Cancelled,PHP,1000.00,120.00,1120.00,0.00,0.00,0.00")).toBe(true);
  });
});

describe("paymentsCsv", () => {
  it("names the method and the tax withheld in the market's words", () => {
    const payment: PaymentRow = {
      receiptNumber: "REC-000001",
      paidOn: "2026-09-30",
      method: "ewallet",
      reference: "=1+1",
      institution: "GCash",
      payerName: "Juan D.C.",
      paidTime: "14:30",
      chequeDate: null,
      currency: "PHP",
      amountMinor: 98_000,
      withheldMinor: 2_000,
      invoiceNumber: "INV-000001",
      customerId: "c1",
      customerName: "Juan Dela Cruz",
      customerTaxId: null,
    };
    expect(lines(paymentsCsv([payment], market))).toEqual([
      "Date paid,Receipt,Bill,Customer,Customer TIN,Method,Reference,Bank or wallet,Paid by,Time paid,Date on cheque,Currency,Received,Tax withheld (BIR Form 2307)",
      `2026-09-30,REC-000001,INV-000001,Juan Dela Cruz,,${market.paymentMethodLabels.ewallet},'=1+1,GCash,Juan D.C.,14:30,,PHP,980.00,20.00`,
    ]);
  });
});

describe("unpaidCsv", () => {
  it("shows each open bill's balance and how many days it's overdue", () => {
    const bill: UnpaidRow = {
      id: "i1",
      number: "INV-000002",
      title: "Billing statement",
      issueDate: "2026-09-01",
      dueDate: "2026-09-16",
      status: "OVERDUE",
      customerId: "c1",
      customerName: "Juan Dela Cruz",
      currency: "PHP",
      totalMinor: 200_000,
      paidMinor: 50_000,
    };
    expect(lines(unpaidCsv([bill], "2026-10-02"))[1]).toBe(
      "INV-000002,Billing statement,Juan Dela Cruz,2026-09-01,2026-09-16,16,PHP,2000.00,500.00,1500.00",
    );
  });
});

describe("withholdingCsv", () => {
  const received: WithholdingCsvRow = {
    status: "Received",
    payorTin: "987-654-321-000",
    payorName: "Dela Cruz Trading",
    receivedOn: "2026-09-20",
    atcCode: "WI160",
    rateBps: 200,
    monthMinor: [50_000, 0, 75_000],
    totalMinor: 125_000,
    taxWithheldMinor: 2_500,
    billingStatements: "INV-000001; INV-000002",
    hasScan: true,
    currency: "PHP",
  };
  const pending: WithholdingCsvRow = {
    status: "Pending",
    payorTin: "",
    payorName: "Maria Reyes",
    receivedOn: null,
    atcCode: null,
    rateBps: null,
    monthMinor: null,
    totalMinor: null,
    taxWithheldMinor: 500,
    billingStatements: "INV-000003",
    hasScan: null,
    currency: "PHP",
  };

  it("writes the quarter, one row per certificate row, then one per pending payment, in the spec's column order", () => {
    expect(lines(withholdingCsv([received, pending], market, { year: 2026, quarter: 3 }))).toEqual([
      "Quarter,Status,Payor TIN,Payor name,Received on,ATC,Rate %,Month 1,Month 2,Month 3,Total income payments,Tax withheld,Billing statements,Has scan,Currency",
      "Q3 2026,Received,987-654-321-000,Dela Cruz Trading,2026-09-20,WI160,2.00,500.00,0.00,750.00,1250.00,25.00,INV-000001; INV-000002,Yes,PHP",
      "Q3 2026,Pending,,Maria Reyes,,,,,,,,5.00,INV-000003,,PHP",
    ]);
  });

  it("says No for a certificate without a scan and prints the rate to two decimals", () => {
    const [, row] = lines(withholdingCsv([{ ...received, hasScan: false, rateBps: 250 }], market, { year: 2026, quarter: 3 }));
    expect(row?.split(",").slice(5, 7)).toEqual(["WI160", "2.50"]);
    expect(row?.endsWith(",No,PHP")).toBe(true);
  });

  it("stops a spreadsheet from running a payor's name as a formula", () => {
    for (const name of ["=cmd|x", "+1", "-2+3", "@SUM(A1)"]) {
      const [, row] = lines(withholdingCsv([{ ...received, payorName: name }], market, { year: 2026, quarter: 3 }));
      expect(row).toContain(`,'${name},`);
    }
  });

  it("writes only the header for an empty quarter", () => {
    expect(lines(withholdingCsv([], market, { year: 2026, quarter: 1 }))).toHaveLength(1);
  });
});
