import type { QuoteHeader } from "@/modules/quotes";
import { daysBetween, formatCalendarDate, type CalendarDate } from "@/shared/dates/calendar";
import { activity, type DocumentPanelData, momentFormat, panelCustomer, validNote } from "../../_documents/panel-data";

type QuotePanelSource = Pick<
  QuoteHeader,
  | "status"
  | "customerId"
  | "customerSnapshot"
  | "issueDate"
  | "validUntil"
  | "sentAt"
  | "viewedAt"
  | "decidedAt"
  | "decisionName"
  | "decisionNote"
  | "cancelledAt"
  | "cancelReason"
>;

/** What the side panel of an issued quotation shows. */
export function quotePanel(
  quote: QuotePanelSource,
  { today, locale, timezone }: { today: CalendarDate; locale: string; timezone: string },
): DocumentPanelData {
  const open = quote.status === "SENT" || quote.status === "VIEWED";
  return {
    customer: panelCustomer(quote.customerSnapshot, quote.customerId),
    facts: [
      { key: "date", label: "Date", value: formatCalendarDate(quote.issueDate, locale) },
      {
        key: "valid",
        label: "Valid until",
        value: formatCalendarDate(quote.validUntil, locale),
        // Only while the customer can still say yes; and an offer running out is not a debt, so it is never a danger.
        ...(open ? { note: validNote(daysBetween(today, quote.validUntil)) } : {}),
      },
    ],
    events: activity(
      [
        { key: "sent", label: "Sent", at: quote.sentAt },
        { key: "viewed", label: "Opened by the customer", at: quote.viewedAt },
        {
          key: "approved",
          label: `Approved by ${quote.decisionName ?? "the customer"}`,
          // A quotation can be called off after the customer said yes, until it becomes an invoice; the yes stays in
          // its history. (A decline can't be called off, only revised, which clears the decision.)
          at: quote.status === "APPROVED" || quote.status === "CANCELLED" ? quote.decidedAt : null,
        },
        {
          key: "declined",
          label: "Declined",
          at: quote.status === "REJECTED" ? quote.decidedAt : null,
          detail: quote.decisionNote,
        },
        { key: "cancelled", label: "Cancelled", at: quote.cancelledAt, detail: quote.cancelReason },
      ],
      momentFormat(locale, timezone),
    ),
    related: [],
  };
}
