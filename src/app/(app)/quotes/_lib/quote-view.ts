import type { MarketProfile } from "@/config/markets";
import { buildDocumentView, type DocumentView, type DocumentViewLineInput } from "@/components/document/document-view";
import { calculateDocument, type LineDiscount } from "@/modules/documents/client";
import type { QuoteDetail } from "@/modules/quotes";

/** A stored line's discount back into the engine's shape. */
function discountOf(line: QuoteDetail["lines"][number]): LineDiscount | null {
  if (line.discountKind === "percent" && line.discountValue !== null) return { kind: "percent", bps: line.discountValue };
  if (line.discountKind === "amount" && line.discountValue !== null) return { kind: "amount", amountMinor: line.discountValue };
  return null;
}

/**
 * A saved quote as a document, from its own line snapshot (names and rates as
 * sent), totalled by the one calculation (§B.2), never by hand.
 */
export function quoteDocumentView(
  quote: QuoteDetail,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): DocumentView {
  const lines: DocumentViewLineInput[] = quote.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitLabel: line.unitLabel,
    unitPriceMinor: line.unitPriceMinor,
    discount: discountOf(line),
    tax: line.taxRateName !== null && line.taxRateBps !== null ? { name: line.taxRateName, rateBps: line.taxRateBps } : null,
  }));
  const snapshot = quote.customerSnapshot;

  return buildDocumentView({
    title: market.documents.quote.singular,
    number: quote.number,
    revision: quote.revision,
    business,
    customer: snapshot
      ? {
          name: snapshot.displayName,
          subtitle: snapshot.company,
          addressLines: snapshot.addressLines,
          contactLines: [snapshot.email, snapshot.phone].filter((l): l is string => Boolean(l)),
          taxId: snapshot.taxId ? { label: market.taxId.label, value: snapshot.taxId } : null,
        }
      : null,
    currency: quote.currency,
    locale,
    taxMode: quote.taxMode,
    dates: [
      { label: "Date", date: quote.issueDate },
      { label: "Valid until", date: quote.validUntil },
    ],
    lines,
    amounts: calculateDocument({ taxMode: quote.taxMode, lines }),
    notes: quote.notes,
    terms: quote.terms,
  });
}
