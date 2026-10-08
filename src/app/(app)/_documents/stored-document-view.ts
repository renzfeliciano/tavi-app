import type { MarketProfile } from "@/config/markets";
import {
  buildDocumentView,
  type DocumentQualifiedDiscountInput,
  type DocumentSalesInput,
  type DocumentView,
  type DocumentViewLineInput,
} from "@/components/document/document-view";
import { calculateDocument, type DocumentAmounts, type LineDiscount, type TaxMode } from "@/modules/documents/client";
import { qualifiedDiscountInput, qualifiedDiscountRows, type QualifiedDiscountSnapshot } from "@/modules/invoices/client";
import { formatRate } from "@/shared/numbers/percent";
import type { CustomerSnapshot } from "@/modules/quotes";
import type { CalendarDate } from "@/shared/dates/calendar";

/** What a saved quote or invoice line keeps: its own snapshot of names and rates. */
export type StoredLine = {
  description: string;
  quantity: number;
  unitLabel: string;
  unitPriceMinor: number;
  discountKind: "percent" | "amount" | null;
  discountValue: number | null;
  taxRateName: string | null;
  taxRateBps: number | null;
};

export type StoredDocument = {
  number: string | null;
  revision: number;
  currency: string;
  taxMode: TaxMode;
  customerSnapshot: CustomerSnapshot | null;
  notes: string | null;
  terms: string | null;
  lines: StoredLine[];
  /** Bills only: a qualified buyer's discount (D19). */
  qualifiedDiscount?: QualifiedDiscountSnapshot | null;
};

/**
 * A bill's qualified discount as the document shows it: the buyer, their ID
 * and the breakdown (RR 7-2024 Sec. 6 B.18), in the market's words.
 */
export function qualifiedDiscountView(
  discount: QualifiedDiscountSnapshot | null | undefined,
  amounts: DocumentAmounts,
  market: MarketProfile,
  locale: string,
): DocumentQualifiedDiscountInput | null {
  const config = market.qualifiedDiscounts;
  if (!discount || !config) return null;
  return {
    label: discount.label,
    idLabel: discount.idLabel,
    idNumber: discount.idNumber,
    holderName: discount.holderName,
    taxExempt: discount.taxExempt,
    signature: config.signature,
    rows: qualifiedDiscountRows(amounts, discount, config.rows, formatRate(discount.rateBps, locale)),
  };
}

/** A stored line's discount back into the engine's shape. */
function discountOf(line: StoredLine): LineDiscount | null {
  if (line.discountKind === "percent" && line.discountValue !== null) return { kind: "percent", bps: line.discountValue };
  if (line.discountKind === "amount" && line.discountValue !== null) return { kind: "amount", amountMinor: line.discountValue };
  return null;
}

/**
 * A saved document as the customer sees it, from its own line snapshot (names
 * and rates as sent), totalled by the one calculation (§B.2), never by hand.
 */
export function storedDocumentView(
  doc: StoredDocument,
  options: {
    title: string;
    dates: { label: string; date: CalendarDate }[];
    business: DocumentView["business"];
    market: MarketProfile;
    locale: string;
    notice: string | null;
    registration?: string | null;
    reprint?: string | null;
    sales?: DocumentSalesInput | null;
    paymentInstructions?: string | null;
  },
): DocumentView {
  const lines: DocumentViewLineInput[] = doc.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitLabel: line.unitLabel,
    unitPriceMinor: line.unitPriceMinor,
    discount: discountOf(line),
    tax: line.taxRateName !== null && line.taxRateBps !== null ? { name: line.taxRateName, rateBps: line.taxRateBps } : null,
  }));
  const snapshot = doc.customerSnapshot;
  const amounts = calculateDocument({
    taxMode: doc.taxMode,
    lines,
    qualifiedDiscount: qualifiedDiscountInput(doc.qualifiedDiscount ?? null),
  });

  return buildDocumentView({
    title: options.title,
    number: doc.number,
    revision: doc.revision,
    business: options.business,
    customer: snapshot
      ? {
          name: snapshot.displayName,
          subtitle: snapshot.company,
          addressLines: snapshot.addressLines,
          contactLines: [snapshot.email, snapshot.phone].filter((l): l is string => Boolean(l)),
          taxId: snapshot.taxId ? { label: options.market.taxId.label, value: snapshot.taxId } : null,
        }
      : null,
    currency: doc.currency,
    locale: options.locale,
    taxMode: doc.taxMode,
    dates: options.dates,
    lines,
    amounts,
    notes: doc.notes,
    terms: doc.terms,
    paymentInstructions: options.paymentInstructions ?? null,
    notice: options.notice,
    registration: options.registration ?? null,
    reprint: options.reprint ?? null,
    sales: options.sales ?? null,
    qualifiedDiscount: qualifiedDiscountView(doc.qualifiedDiscount, amounts, options.market, options.locale),
  });
}
