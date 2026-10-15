import { type InvoiceHeader, OWING_INVOICE_STATUSES } from "@/modules/invoices";
import { daysBetween, formatCalendarDate, type CalendarDate } from "@/shared/dates/calendar";
import { activity, type DocumentPanelData, dueNote, momentFormat, panelCustomer } from "../../_documents/panel-data";

type InvoicePanelSource = Pick<
  InvoiceHeader,
  | "status"
  | "customerId"
  | "customerSnapshot"
  | "sourceQuoteId"
  | "recurringScheduleId"
  | "issueDate"
  | "dueDate"
  | "sentAt"
  | "viewedAt"
  | "editedAt"
  | "voidedAt"
  | "voidReason"
  | "cancelledAt"
  | "cancelReason"
>;

/** What the side panel of an issued billing statement shows. `quoteTitle` is the business's word for a quotation. */
export function invoicePanel(
  invoice: InvoicePanelSource,
  { today, locale, timezone, quoteTitle }: { today: CalendarDate; locale: string; timezone: string; quoteTitle: string },
): DocumentPanelData {
  const owing = (OWING_INVOICE_STATUSES as readonly string[]).includes(invoice.status);
  const days = daysBetween(today, invoice.dueDate);
  return {
    customer: panelCustomer(invoice.customerSnapshot, invoice.customerId),
    facts: [
      { key: "date", label: "Date", value: formatCalendarDate(invoice.issueDate, locale) },
      {
        key: "due",
        label: "Due date",
        value: formatCalendarDate(invoice.dueDate, locale),
        // Only what is still owed has a due date worth counting down to, or worth flagging.
        ...(owing ? { note: dueNote(days), ...(days < 0 ? { danger: true } : {}) } : {}),
      },
    ],
    events: activity(
      [
        { key: "sent", label: "Sent", at: invoice.sentAt },
        { key: "viewed", label: "Opened by the customer", at: invoice.viewedAt },
        { key: "edited", label: "Updated", at: invoice.editedAt },
        { key: "voided", label: "Voided", at: invoice.voidedAt, detail: invoice.voidReason },
        { key: "cancelled", label: "Cancelled", at: invoice.cancelledAt, detail: invoice.cancelReason },
      ],
      momentFormat(locale, timezone),
    ),
    related: [
      ...(invoice.sourceQuoteId
        ? [{ key: "quote", label: `From the approved ${quoteTitle.toLowerCase()}`, href: `/quotes/${invoice.sourceQuoteId}` }]
        : []),
      ...(invoice.recurringScheduleId
        ? [{ key: "schedule", label: "From a recurring schedule", href: `/recurring/${invoice.recurringScheduleId}` }]
        : []),
    ],
  };
}
