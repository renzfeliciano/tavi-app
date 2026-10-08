import { describe, expect, it } from "vitest";
import { buildEInvoice, type EInvoiceSource } from "./e-invoice";
import { E_INVOICE_FORMAT, eInvoiceFile, eInvoiceJson, percent } from "./e-invoice-format";

// A senior citizen's ₱1,120.00 (VAT-inclusive) aircon cleaning plus a ₱200.00
// VAT-exempt part, on a registered invoice (D19).
const source: EInvoiceSource = {
  invoice: {
    id: "0b9c1c1e-0000-4000-8000-000000000001",
    number: "0007",
    title: "Service Invoice",
    status: "PARTIALLY_PAID",
    revision: 1,
    issueDate: "2026-10-08",
    dueDate: "2026-10-23",
    currency: "PHP",
    taxMode: "inclusive",
    registration: {
      number: "0412-123-00045",
      issuedOn: "2026-09-15",
      seriesStart: 1,
      seriesEnd: 5000,
      title: "Service Invoice",
      serial: 7,
      sales: { kind: "vat", vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 0, exemptMinor: 120_000, lines: ["exempt", "exempt"] },
    },
    customer: { name: "Remedios Santos", company: null, taxId: null, addressLines: ["12 Mabini St", "Taguig, Metro Manila 1630"] },
    subtotalMinor: 132_000,
    discountTotalMinor: 0,
    taxTotalMinor: 0,
    totalMinor: 96_000,
    qualifiedDiscount: {
      kind: "senior_citizen",
      label: "Senior citizen",
      idLabel: "OSCA / SC ID No.",
      idNumber: "OSCA-0042",
      holderName: "Remedios Santos",
      rateBps: 2000,
      taxExempt: true,
    },
    qualifiedDiscountMinor: 24_000,
    taxWaivedMinor: 12_000,
    voidReason: null,
    cancelReason: null,
  },
  lines: [
    {
      position: 1,
      description: "Parts",
      unitLabel: "pc",
      quantity: 10_000,
      unitPriceMinor: 20_000,
      grossMinor: 20_000,
      discountMinor: 0,
      taxRateName: null,
      taxRateBps: null,
      taxMinor: 0,
      totalMinor: 16_000,
      qualifiedDiscountMinor: 4_000,
      taxWaivedMinor: 0,
    },
    {
      position: 0,
      description: "Aircon cleaning",
      unitLabel: "unit",
      quantity: 15_000,
      unitPriceMinor: 74_667,
      grossMinor: 112_000,
      discountMinor: 0,
      taxRateName: "VAT",
      taxRateBps: 1200,
      taxMinor: 0,
      totalMinor: 80_000,
      qualifiedDiscountMinor: 20_000,
      taxWaivedMinor: 12_000,
    },
  ],
  seller: {
    registeredName: "Santos Aircon Services",
    tradeName: "Santos Aircon",
    taxId: "123-456-789-00000",
    taxIdStatement: "VAT Reg TIN",
    addressLines: ["Unit 5, Bonifacio", "Taguig, Metro Manila 1634"],
  },
  withheldMinor: 1_000,
};

describe("buildEInvoice", () => {
  it("lays out a registered invoice in line order, with its breakdown, discount and withholding", () => {
    const e = buildEInvoice(source);
    expect(e).toMatchObject({
      serialNumber: "0007",
      serial: 7,
      status: "issued",
      statusReason: null,
      pricesIncludeTax: true,
      registration: { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: 1, seriesEnd: 5000 },
      qualifiedDiscount: { kind: "senior_citizen", idNumber: "OSCA-0042", rateBps: 2000, taxExempt: true },
      totals: { grossSalesMinor: 132_000, qualifiedDiscountMinor: 24_000, taxWaivedMinor: 12_000, totalDueMinor: 96_000, withheldMinor: 1_000 },
    });
    expect(e.lines.map((l) => [l.position, l.description, l.saleCategory])).toEqual([
      [1, "Aircon cleaning", "exempt"],
      [2, "Parts", "exempt"],
    ]);
  });

  it("says when an invoice was voided or cancelled, and why", () => {
    expect(buildEInvoice({ ...source, invoice: { ...source.invoice, status: "VOID", voidReason: "Wrong buyer" } })).toMatchObject({
      status: "void",
      statusReason: "Wrong buyer",
    });
    expect(buildEInvoice({ ...source, invoice: { ...source.invoice, status: "CANCELLED", cancelReason: "Called off" } })).toMatchObject({
      status: "cancelled",
      statusReason: "Called off",
    });
  });

  it("never builds a draft", () => {
    expect(() => buildEInvoice({ ...source, invoice: { ...source.invoice, status: "DRAFT" } })).toThrow();
  });
});

describe("the JSON format (the mapping file)", () => {
  it("writes money and quantities as exact decimal strings and dates as ISO 8601", () => {
    const json = eInvoiceJson(buildEInvoice(source));
    expect(json).toMatchObject({
      invoiceType: "Service Invoice",
      serialNo: "0007",
      issueDate: "2026-10-08",
      status: "ISSUED",
      systemRegistration: { permitOrAcknowledgementNo: "0412-123-00045", dateIssued: "2026-09-15", approvedSeriesFrom: 1, approvedSeriesTo: 5000 },
      seller: { registeredName: "Santos Aircon Services", tinStatement: "VAT Reg TIN", tin: "123-456-789-00000" },
      buyer: { registeredName: "Remedios Santos", tin: null, address: "12 Mabini St, Taguig, Metro Manila 1630" },
      specialDiscount: { type: "SENIOR_CITIZEN", idNo: "OSCA-0042", name: "Remedios Santos", rate: "20.00", vatExempt: true },
      totals: {
        totalSales: "1320.00",
        specialDiscount: "240.00",
        vatableSales: "0.00",
        vatExemptSales: "1200.00",
        salesSubjectToPercentageTax: null,
        taxExempted: "120.00",
        totalAmountDue: "960.00",
        withholdingTax: "10.00",
      },
    });
    expect(json.items[0]).toEqual({
      lineNo: 1,
      description: "Aircon cleaning",
      quantity: "1.5000",
      unit: "unit",
      unitPrice: "746.67",
      grossAmount: "1120.00",
      discountAmount: "0.00",
      specialDiscountAmount: "200.00",
      saleType: "VAT_EXEMPT",
      taxName: "VAT",
      taxRate: "12.00",
      taxAmount: "0.00",
      taxExemptedAmount: "120.00",
      lineTotal: "800.00",
    });
  });

  it("puts the format notice on every file: TAVI isn't BIR-certified yet", () => {
    const file = eInvoiceFile([buildEInvoice(source)], { generatedAt: new Date("2026-10-08T03:00:00Z"), period: { from: "2026-10-01", to: "2026-10-31" } });
    expect(file).toMatchObject({
      format: { name: "tavi-e-invoice", version: 1, birCertified: false },
      generatedAt: "2026-10-08T03:00:00.000Z",
      period: { from: "2026-10-01", to: "2026-10-31" },
    });
    expect(file.invoices).toHaveLength(1);
    expect(E_INVOICE_FORMAT.note).toMatch(/not yet BIR-certified/);
  });

  it("formats rates with integer maths", () => {
    expect([percent(1200), percent(1250), percent(5), percent(0), percent(10_000)]).toEqual(["12.00", "12.50", "0.05", "0.00", "100.00"]);
  });
});
