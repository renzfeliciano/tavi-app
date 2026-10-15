import type { DocumentView } from "@/components/document/document-view";
import type { MarketProfile } from "@/config/markets";
import type { PurchaseOrderDetail } from "@/modules/purchasing";
import type { CalendarDate } from "@/shared/dates/calendar";
import { storedDocumentView } from "../../_documents/stored-document-view";

/**
 * A saved purchase order as a document (the business's page and its PDF). The
 * supplier is the one frozen at issue; the contact person sits under the name.
 * An order asks for no payment, so it prints no payment instructions.
 */
export function purchaseOrderView(
  order: PurchaseOrderDetail,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): DocumentView {
  const supplier = order.supplierSnapshot;
  const dates: { label: string; date: CalendarDate }[] = [{ label: "Date", date: order.orderDate }];
  if (order.expectedDate) dates.push({ label: "Expected by", date: order.expectedDate });
  if (order.receivedDate) dates.push({ label: "Received", date: order.receivedDate });

  return storedDocumentView(
    {
      number: order.number,
      revision: 1,
      currency: order.currency,
      taxMode: order.taxMode,
      customerSnapshot: supplier
        ? {
            displayName: supplier.displayName,
            company: supplier.contactName,
            email: supplier.email,
            phone: supplier.phone,
            addressLines: supplier.addressLines,
            taxId: supplier.taxId,
          }
        : // A draft has nothing frozen yet, so it shows the supplier as chosen now.
          order.supplier
          ? { displayName: order.supplier.displayName, company: null, email: order.supplier.email, phone: null, addressLines: [], taxId: null }
          : null,
      notes: order.notes,
      terms: order.terms,
      lines: order.lines,
    },
    {
      title: market.documents.purchaseOrder.singular,
      partyLabel: "Order to",
      dates,
      business,
      market,
      locale,
      // A supplementary document (RR 7-2024 Sec. 6 B.15, D13): never an invoice or receipt.
      notice: market.supplementaryDocumentNotice,
      imprint: order.status === "RECEIVED" ? "Received" : order.status === "CANCELLED" ? "Cancelled" : null,
    },
  );
}
