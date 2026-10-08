import type { InvoiceRegistrationSnapshot } from "./registration";
import type { QualifiedDiscountSnapshot } from "./qualified-discount";
import type { SaleCategory, SalesBreakdown } from "./sales-breakdown";
import type { InvoiceStatus } from "./status";

// A registered invoice as structured data, ready for electronic invoicing
// (D19; PH: RR 11-2025 as amended by RR 26-2025, RMC 98-2026 Sec. IV.6: the
// minimum invoice contents of Tax Code Sec. 113 and RR 7-2024, plus details
// such as discounts and withholding taxes). This is TAVI's own model, in
// minor units and scaled quantities; `e-invoice-format.ts` turns it into the
// JSON people download, and is the one file to change once the BIR's EIS
// specification is in hand. TAVI isn't BIR-certified: the export says so.

export type EInvoiceSource = {
  invoice: {
    id: string;
    number: string;
    title: string;
    status: InvoiceStatus;
    revision: number;
    issueDate: string;
    dueDate: string;
    currency: string;
    taxMode: "inclusive" | "exclusive";
    registration: InvoiceRegistrationSnapshot;
    customer: { name: string; company: string | null; taxId: string | null; addressLines: string[] } | null;
    subtotalMinor: number;
    discountTotalMinor: number;
    taxTotalMinor: number;
    totalMinor: number;
    qualifiedDiscount: QualifiedDiscountSnapshot | null;
    qualifiedDiscountMinor: number;
    taxWaivedMinor: number;
    voidReason: string | null;
    cancelReason: string | null;
  };
  lines: readonly {
    position: number;
    description: string;
    unitLabel: string;
    quantity: number;
    unitPriceMinor: number;
    grossMinor: number;
    discountMinor: number;
    taxRateName: string | null;
    taxRateBps: number | null;
    taxMinor: number;
    totalMinor: number;
    qualifiedDiscountMinor: number;
    taxWaivedMinor: number;
  }[];
  seller: {
    registeredName: string;
    tradeName: string | null;
    taxId: string | null;
    /** e.g. "VAT Reg TIN" (RR 7-2024 Sec. 6 B.2). */
    taxIdStatement: string | null;
    addressLines: string[];
  };
  /** Creditable tax the buyer withheld on the payments recorded so far (PH: Form 2307). */
  withheldMinor: number;
};

export type EInvoiceLine = {
  position: number;
  description: string;
  unit: string;
  /** Scaled ×10 000. */
  quantity: number;
  unitPriceMinor: number;
  grossMinor: number;
  discountMinor: number;
  /** B.13–B.14, for VAT-registered sellers; null otherwise. */
  saleCategory: SaleCategory | null;
  tax: { name: string; rateBps: number } | null;
  taxMinor: number;
  qualifiedDiscountMinor: number;
  taxWaivedMinor: number;
  totalMinor: number;
};

export type EInvoice = {
  invoiceId: string;
  title: string;
  serialNumber: string;
  serial: number;
  revision: number;
  /** Issued, or voided / cancelled after issue (with the reason). */
  status: "issued" | "void" | "cancelled";
  statusReason: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  /** How the prices were entered: tax included or added on top. */
  pricesIncludeTax: boolean;
  registration: { number: string; issuedOn: string; seriesStart: number; seriesEnd: number };
  seller: EInvoiceSource["seller"];
  buyer: EInvoiceSource["invoice"]["customer"];
  lines: EInvoiceLine[];
  qualifiedDiscount: Omit<QualifiedDiscountSnapshot, "idLabel"> | null;
  totals: {
    grossSalesMinor: number;
    discountMinor: number;
    qualifiedDiscountMinor: number;
    taxMinor: number;
    taxWaivedMinor: number;
    totalDueMinor: number;
    withheldMinor: number;
    /** The invoice's printed sales breakdown (B.13–B.17), as issued. */
    sales: SalesBreakdown | null;
  };
};

function statusOf(status: InvoiceStatus): EInvoice["status"] {
  if (status === "VOID") return "void";
  if (status === "CANCELLED") return "cancelled";
  return "issued";
}

/** A registered invoice as structured data. Drafts and billing statements aren't invoices, so they never get here. */
export function buildEInvoice({ invoice, lines, seller, withheldMinor }: EInvoiceSource): EInvoice {
  if (invoice.status === "DRAFT") throw new Error("A draft isn't an issued invoice");
  const { registration } = invoice;
  const sales = registration.sales ?? null;
  const categories = sales?.kind === "vat" ? sales.lines : null;
  const status = statusOf(invoice.status);
  const qualified = invoice.qualifiedDiscount;
  return {
    invoiceId: invoice.id,
    title: invoice.title,
    serialNumber: invoice.number,
    serial: registration.serial,
    revision: invoice.revision,
    status,
    statusReason: status === "void" ? invoice.voidReason : status === "cancelled" ? invoice.cancelReason : null,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    pricesIncludeTax: invoice.taxMode === "inclusive",
    registration: {
      number: registration.number,
      issuedOn: registration.issuedOn,
      seriesStart: registration.seriesStart,
      seriesEnd: registration.seriesEnd,
    },
    seller,
    buyer: invoice.customer,
    lines: [...lines]
      .sort((a, b) => a.position - b.position)
      .map((line, i) => ({
        position: i + 1,
        description: line.description,
        unit: line.unitLabel,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        grossMinor: line.grossMinor,
        discountMinor: line.discountMinor,
        saleCategory: categories?.[i] ?? null,
        tax: line.taxRateName !== null && line.taxRateBps !== null ? { name: line.taxRateName, rateBps: line.taxRateBps } : null,
        taxMinor: line.taxMinor,
        qualifiedDiscountMinor: line.qualifiedDiscountMinor,
        taxWaivedMinor: line.taxWaivedMinor,
        totalMinor: line.totalMinor,
      })),
    qualifiedDiscount: qualified
      ? {
          kind: qualified.kind,
          label: qualified.label,
          idNumber: qualified.idNumber,
          holderName: qualified.holderName,
          rateBps: qualified.rateBps,
          taxExempt: qualified.taxExempt,
        }
      : null,
    totals: {
      grossSalesMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountTotalMinor,
      qualifiedDiscountMinor: invoice.qualifiedDiscountMinor,
      taxMinor: invoice.taxTotalMinor,
      taxWaivedMinor: invoice.taxWaivedMinor,
      totalDueMinor: invoice.totalMinor,
      withheldMinor,
      sales,
    },
  };
}
