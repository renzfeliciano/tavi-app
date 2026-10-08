import type { MarketProfile } from "@/config/markets";
import type { DocumentView } from "@/components/document/document-view";
import { type InvoiceCopy, type InvoiceDetail, invoiceTitle, registrationFooter, salesBreakdownRows } from "@/modules/invoices";
import { storedDocumentView } from "../../_documents/stored-document-view";

/**
 * A saved invoice as a document (the business's page and the customer's).
 * `copy` is set for a counted PDF of a registered invoice: a reprint says so.
 */
export function invoiceDocumentView(
  invoice: Omit<InvoiceDetail, "customer">,
  {
    business,
    market,
    locale,
    copy = null,
  }: { business: DocumentView["business"]; market: MarketProfile; locale: string; copy?: InvoiceCopy | null },
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
    // RR 7-2024 Sec. 6 B.21 (top portion): "REPRINT" on every print after the first (D19).
    reprint: registration && copy === "reprint" ? (market.invoiceRegistration?.reprint ?? null) : null,
    // B.13–B.17, as computed when it was issued.
    sales: registration?.sales && market.invoiceRegistration ? salesBreakdownRows(registration.sales, market.invoiceRegistration.sales) : null,
  });
}
