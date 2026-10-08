import { brand } from "@/config/brand";
import { minorToDecimalString } from "@/shared/money";
import type { EInvoice, EInvoiceLine } from "./e-invoice";

// THE MAPPING FILE (D19). How TAVI writes an e-invoice as JSON. The BIR's EIS
// takes JSON (RMC 98-2026 Sec. IV.6), but its field list is published on the
// EIS Certification Portal (eis-cert.bir.gov.ph), behind a taxpayer login,
// so the names below are TAVI's own, chosen to read plainly. Once the
// official specification is in hand, change the field names, date format and
// number format here; nothing else needs to move. Until TAVI passes EIS
// certification, every file says it isn't certified.

export const E_INVOICE_FORMAT = {
  name: `${brand.name.toLowerCase()}-e-invoice`,
  version: 1,
  birCertified: false,
  note:
    "Structured copy of a registered invoice, prepared for the BIR's Electronic Invoicing System (EIS). " +
    `Field names are ${brand.name}'s own until the official EIS specification is applied; ${brand.name} is not yet BIR-certified, ` +
    "so this file isn't transmitted to the BIR.",
};

/** Money as an exact decimal string in the currency's decimals ("1120.00"). */
const amount = (minor: number, currency: string) => minorToDecimalString(minor, currency);

/** Basis points as a percentage string ("12.00"). Integer maths: no float rounding. */
export const percent = (bps: number) => `${Math.trunc(bps / 100)}.${String(bps % 100).padStart(2, "0")}`;

/** A scaled quantity as a decimal string ("1.5000"). */
const quantity = (scaled: number) => `${Math.trunc(scaled / 10_000)}.${String(scaled % 10_000).padStart(4, "0")}`;

/** Dates stay ISO 8601 (yyyy-mm-dd) until the specification says otherwise. */
const date = (value: string) => value;

const SALE_CATEGORY = { vatable: "VATABLE", zero_rated: "ZERO_RATED", exempt: "VAT_EXEMPT" } as const;

function line(l: EInvoiceLine, currency: string) {
  return {
    lineNo: l.position,
    description: l.description,
    quantity: quantity(l.quantity),
    unit: l.unit,
    unitPrice: amount(l.unitPriceMinor, currency),
    grossAmount: amount(l.grossMinor, currency),
    discountAmount: amount(l.discountMinor, currency),
    specialDiscountAmount: amount(l.qualifiedDiscountMinor, currency),
    saleType: l.saleCategory ? SALE_CATEGORY[l.saleCategory] : null,
    taxName: l.tax?.name ?? null,
    taxRate: l.tax ? percent(l.tax.rateBps) : null,
    taxAmount: amount(l.taxMinor, currency),
    taxExemptedAmount: amount(l.taxWaivedMinor, currency),
    lineTotal: amount(l.totalMinor, currency),
  };
}

/** One e-invoice as JSON-ready data. */
export function eInvoiceJson(e: EInvoice) {
  const c = e.currency;
  const sales = e.totals.sales;
  return {
    invoiceType: e.title,
    serialNo: e.serialNumber,
    issueDate: date(e.issueDate),
    dueDate: date(e.dueDate),
    currency: c,
    pricesIncludeTax: e.pricesIncludeTax,
    revision: e.revision,
    status: e.status.toUpperCase(),
    statusReason: e.statusReason,
    systemRegistration: {
      permitOrAcknowledgementNo: e.registration.number,
      dateIssued: date(e.registration.issuedOn),
      approvedSeriesFrom: e.registration.seriesStart,
      approvedSeriesTo: e.registration.seriesEnd,
    },
    seller: {
      registeredName: e.seller.registeredName,
      tradeName: e.seller.tradeName,
      tinStatement: e.seller.taxIdStatement,
      tin: e.seller.taxId,
      address: e.seller.addressLines.join(", "),
    },
    buyer: e.buyer
      ? {
          registeredName: e.buyer.company ?? e.buyer.name,
          name: e.buyer.name,
          tin: e.buyer.taxId,
          address: e.buyer.addressLines.join(", ") || null,
        }
      : null,
    items: e.lines.map((l) => line(l, c)),
    specialDiscount: e.qualifiedDiscount
      ? {
          type: e.qualifiedDiscount.kind.toUpperCase(),
          description: e.qualifiedDiscount.label,
          idNo: e.qualifiedDiscount.idNumber,
          name: e.qualifiedDiscount.holderName,
          rate: percent(e.qualifiedDiscount.rateBps),
          vatExempt: e.qualifiedDiscount.taxExempt,
        }
      : null,
    totals: {
      totalSales: amount(e.totals.grossSalesMinor, c),
      discount: amount(e.totals.discountMinor, c),
      specialDiscount: amount(e.totals.qualifiedDiscountMinor, c),
      vatableSales: sales?.kind === "vat" ? amount(sales.vatableMinor, c) : null,
      vatAmount: sales?.kind === "vat" ? amount(sales.vatMinor, c) : null,
      zeroRatedSales: sales?.kind === "vat" ? amount(sales.zeroRatedMinor, c) : null,
      vatExemptSales: sales?.kind === "vat" ? amount(sales.exemptMinor, c) : null,
      salesSubjectToPercentageTax: sales?.kind === "percentage_tax" ? amount(sales.amountMinor, c) : null,
      sellerExempt: sales?.kind === "exempt",
      taxAmount: amount(e.totals.taxMinor, c),
      taxExempted: amount(e.totals.taxWaivedMinor, c),
      totalAmountDue: amount(e.totals.totalDueMinor, c),
      withholdingTax: amount(e.totals.withheldMinor, c),
    },
  };
}

/** The file people download: the format notice, then one or more invoices. */
export function eInvoiceFile(
  invoices: readonly EInvoice[],
  { generatedAt, period }: { generatedAt: Date; period?: { from: string; to: string } },
) {
  return {
    format: E_INVOICE_FORMAT,
    generatedAt: generatedAt.toISOString(),
    ...(period ? { period: { from: date(period.from), to: date(period.to) } } : {}),
    invoices: invoices.map(eInvoiceJson),
  };
}
