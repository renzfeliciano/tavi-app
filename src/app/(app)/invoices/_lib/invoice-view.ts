import type { MarketProfile } from "@/config/markets";
import type { DocumentView } from "@/components/document/document-view";
import { type InvoiceDetail, invoiceTitle, registrationFooter } from "@/modules/invoices";
import { storedDocumentView } from "../../_documents/stored-document-view";

/** A saved invoice as a document (the business's page and the customer's). */
export function invoiceDocumentView(
  invoice: Omit<InvoiceDetail, "customer">,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): DocumentView {
  const { registration } = invoice;
  return storedDocumentView(invoice, {
    title: invoiceTitle(invoice, market),
    dates: [
      { label: "Date", date: invoice.issueDate },
      { label: "Due date", date: invoice.dueDate },
    ],
    business,
    market,
    locale,
    paymentInstructions: invoice.paymentInstructions,
    // A billing statement is a supplementary document (RR 7-2024 Sec. 6 B.15,
    // D13); a registered invoice prints its system registration instead (B.21).
    notice: registration ? null : market.supplementaryDocumentNotice,
    registration: registration ? registrationFooter(registration, market, locale) : null,
  });
}
