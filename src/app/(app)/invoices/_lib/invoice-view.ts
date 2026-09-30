import type { MarketProfile } from "@/config/markets";
import type { DocumentView } from "@/components/document/document-view";
import type { InvoiceDetail } from "@/modules/invoices";
import { storedDocumentView } from "../../_documents/stored-document-view";

/** A saved invoice as a document (the business's page and the customer's). */
export function invoiceDocumentView(
  invoice: Omit<InvoiceDetail, "customer">,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): DocumentView {
  return storedDocumentView(invoice, {
    title: market.documents.invoice.singular,
    dates: [
      { label: "Date", date: invoice.issueDate },
      { label: "Due date", date: invoice.dueDate },
    ],
    business,
    market,
    locale,
    paymentInstructions: invoice.paymentInstructions,
    // Until the business registers TAVI with the BIR (invoice mode, 1.7c), a
    // bill is a billing statement: a supplementary document (RR 7-2024 Sec. 6 B.15, D13).
    notice: market.supplementaryDocumentNotice,
  });
}
