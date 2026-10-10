import type { DocumentAmounts, LineDiscount, TaxMode } from "@/modules/documents/client";
import { formatQuantity } from "@/modules/documents/client";
import { type CalendarDate, formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { formatRate } from "@/shared/numbers/percent";

// Everything a rendered document shows, as display strings. One builder feeds
// the editor's live preview, the saved quote page and (later) the customer's
// page and PDF, so they always read the same (§G.3). Amounts come from
// calculateDocument; this only formats them.

export type DocumentParty = {
  name: string;
  /** Second line under the name, e.g. the company or registered name. */
  subtitle: string | null;
  addressLines: string[];
  contactLines: string[];
  taxId: { label: string; value: string } | null;
};

export type DocumentViewLine = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string | null;
  tax: string | null;
  amount: string;
};

export type DocumentView = {
  title: string;
  number: string | null;
  revision: number;
  business: DocumentParty & { logo: { src: string; width: number; height: number } | null };
  customer: DocumentParty | null;
  dates: { label: string; value: string }[];
  lines: DocumentViewLine[];
  totals: { label: string; value: string; emphasis?: boolean }[];
  /** For tax-inclusive documents: "Includes VAT 12%: ₱321.43". */
  taxNotes: string[];
  notes: string | null;
  terms: string | null;
  /** How to pay (invoices): the business's bank or e-wallet details, as issued. */
  paymentInstructions: string | null;
  /** Printed in bold at the foot, e.g. "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX." */
  notice: string | null;
  /** Registered invoices only: the system registration at the foot (RR 7-2024 Sec. 6 B.21). */
  registration?: string | null;
  /** Registered invoices' PDFs after the first: "REPRINT", printed prominently at the top (B.21, D19). */
  reprint?: string | null;
  /** The Stamp's imprint for a settled document: "Paid" or "Approved" (D20). Decorative; the status is also in the page's own text. */
  imprint?: string | null;
  /** Registered invoices only: the sales breakdown (B.13, B.17) and the seller's statement, e.g. "EXEMPT" (B.16). */
  sales?: { rows: { label: string; value: string }[]; statement: string | null } | null;
  /**
   * A qualified buyer's discount (D19; PH: RR 7-2024 Sec. 6 B.18): who, their
   * ID, and the line they sign on. Its breakdown replaces the usual totals.
   */
  qualifiedDiscount?: { holder: string; idLine: string; signature: string } | null;
};

/** A bill's qualified discount, ready to show: the breakdown rows in minor units (from qualifiedDiscountRows). */
export type DocumentQualifiedDiscountInput = {
  label: string;
  idLabel: string;
  idNumber: string;
  holderName: string;
  taxExempt: boolean;
  signature: string;
  rows: { label: string; amountMinor: number; emphasis?: boolean; deduction?: boolean }[];
};

/** A registered invoice's sales breakdown, in minor units, with each line's sale wording (B.14). */
export type DocumentSalesInput = {
  rows: { label: string; amountMinor: number }[];
  lineTax: (string | null)[];
  statement: string | null;
};

export type DocumentViewLineInput = {
  description: string;
  quantity: number;
  unitLabel: string;
  unitPriceMinor: number;
  discount: LineDiscount | null;
  tax: { name: string; rateBps: number } | null;
};

export type DocumentViewInput = {
  title: string;
  number: string | null;
  revision: number;
  business: DocumentView["business"];
  customer: DocumentParty | null;
  currency: string;
  locale: string;
  taxMode: TaxMode;
  dates: { label: string; date: CalendarDate }[];
  lines: DocumentViewLineInput[];
  amounts: DocumentAmounts;
  notes: string | null;
  terms: string | null;
  paymentInstructions?: string | null;
  notice: string | null;
  registration?: string | null;
  reprint?: string | null;
  imprint?: string | null;
  sales?: DocumentSalesInput | null;
  qualifiedDiscount?: DocumentQualifiedDiscountInput | null;
};

export function buildDocumentView(input: DocumentViewInput): DocumentView {
  const { currency, locale, amounts } = input;
  const money = (minor: number) => formatMoney(minor, currency, { locale });

  const lines = input.lines.map((line, i): DocumentViewLine => {
    const a = amounts.lines[i];
    return {
      description: line.description,
      quantity: formatQuantity(line.quantity, locale),
      unit: line.unitLabel,
      unitPrice: money(line.unitPriceMinor),
      discount:
        line.discount === null || !a || a.discountMinor === 0
          ? null
          : line.discount.kind === "percent"
            ? `−${formatRate(line.discount.bps, locale)}`
            : `−${money(a.discountMinor)}`,
      // A registered invoice names zero-rated and exempt sales on the line (B.14);
      // a tax-exempt qualified discount (D19) makes the line's tax exempt.
      tax:
        input.sales?.lineTax[i] ??
        (line.tax
          ? input.qualifiedDiscount?.taxExempt && line.tax.rateBps > 0
            ? `${line.tax.name}-exempt`
            : `${line.tax.name} ${formatRate(line.tax.rateBps, locale)}`
          : null),
      amount: money(a ? a.netMinor : 0),
    };
  });

  const qualified = input.qualifiedDiscount ?? null;
  const totals: DocumentView["totals"] = [];
  const taxNotes: string[] = [];
  if (qualified) {
    // B.18.b: the discount and tax-exemption breakdown, ending at the total due.
    for (const row of qualified.rows) {
      totals.push({
        label: row.label,
        value: row.deduction && row.amountMinor > 0 ? `−${money(row.amountMinor)}` : money(row.amountMinor),
        ...(row.emphasis ? { emphasis: true } : {}),
      });
    }
  } else {
    totals.push({ label: "Subtotal", value: money(amounts.subtotalMinor) });
    if (amounts.discountTotalMinor > 0) totals.push({ label: "Discount", value: `−${money(amounts.discountTotalMinor)}` });
    for (const group of amounts.taxes) {
      const label = `${group.name} ${formatRate(group.rateBps, locale)}`;
      if (input.taxMode === "exclusive") totals.push({ label, value: money(group.taxMinor) });
      else if (group.taxMinor > 0) taxNotes.push(`Includes ${label}: ${money(group.taxMinor)}`);
    }
    totals.push({ label: "Total", value: money(amounts.totalMinor), emphasis: true });
  }

  return {
    title: input.title,
    number: input.number,
    revision: input.revision,
    business: input.business,
    customer: input.customer,
    dates: input.dates.map((d) => ({ label: d.label, value: formatCalendarDate(d.date, locale) })),
    lines,
    totals,
    taxNotes,
    notes: input.notes,
    terms: input.terms,
    paymentInstructions: input.paymentInstructions ?? null,
    notice: input.notice,
    registration: input.registration ?? null,
    reprint: input.reprint ?? null,
    imprint: input.imprint ?? null,
    qualifiedDiscount: qualified
      ? {
          holder: `${qualified.label}: ${qualified.holderName}`,
          idLine: `${qualified.idLabel} ${qualified.idNumber}`,
          signature: qualified.signature,
        }
      : null,
    sales: input.sales
      ? { rows: input.sales.rows.map((r) => ({ label: r.label, value: money(r.amountMinor) })), statement: input.sales.statement }
      : null,
  };
}
