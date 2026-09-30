import type { MarketProfile } from "@/config/markets";
import type { DocumentView } from "@/components/document/document-view";
import type { QuoteDetail } from "@/modules/quotes";
import { storedDocumentView } from "../../_documents/stored-document-view";

/** A saved quote as a document (the business's page and the customer's). */
export function quoteDocumentView(
  quote: Omit<QuoteDetail, "customer">,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): DocumentView {
  return storedDocumentView(quote, {
    title: market.documents.quote.singular,
    dates: [
      { label: "Date", date: quote.issueDate },
      { label: "Valid until", date: quote.validUntil },
    ],
    business,
    market,
    locale,
    // Quotations are supplementary documents (RR 7-2024 Sec. 6 B.15, D13).
    notice: market.supplementaryDocumentNotice,
  });
}
