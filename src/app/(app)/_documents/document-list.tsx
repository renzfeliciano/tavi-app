import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { DocumentNumber } from "@/components/document-number";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MissingCustomer } from "@/components/missing-customer";
import { MoneyAmount } from "@/components/money-amount";
import { PaidProgress } from "@/components/paid-progress";
import { StatusBadge } from "@/components/status/status-badge";
import type { InvoiceList } from "@/modules/invoices";
import type { QuoteList } from "@/modules/quotes";
import { formatCalendarDate } from "@/shared/dates/calendar";

// The quotation and billing statement lists' columns: one definition each for the
// table and for its skeleton, so the two never drift. The market's own names
// ("Quotation", "Billing statement") come from the page's heading and labels.

export type QuoteRow = QuoteList["quotes"][number];
export type InvoiceRow = InvoiceList["invoices"][number];

/** Who it is for leads; the serial sits under it. A draft has no number yet and says so, instead of leaving a gap. */
function Customer({ name, number, extra }: { name: string | null; number: string | null; extra?: string }) {
  return (
    <>
      <CellTitle>{name ?? <MissingCustomer />}</CellTitle>
      <CellSub>
        {number !== null ? <DocumentNumber number={number} /> : "Not sent yet"}
        {extra && ` · ${extra}`}
      </CellSub>
    </>
  );
}

export const quoteColumns = (locale: string): DataColumn<QuoteRow>[] => [
  {
    id: "customer",
    header: "Customer",
    width: "minmax(0,2.2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (quote) => (
      <Customer name={quote.customerName} number={quote.number} extra={quote.revision > 1 ? `Rev ${quote.revision}` : undefined} />
    ),
  },
  {
    id: "date",
    header: "Date",
    width: "minmax(0,1.3fr)",
    hideBelow: "md",
    skeleton: ["md", "md"],
    cell: (quote) => (
      <>
        <span className="block truncate text-sm">{formatCalendarDate(quote.issueDate, locale)}</span>
        <CellSub>Valid until {formatCalendarDate(quote.validUntil, locale)}</CellSub>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "9.5rem",
    skeleton: "sm",
    cell: (quote) => <StatusBadge kind="quote" status={quote.status} />,
  },
  {
    id: "amount",
    header: "Amount",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (quote) => (
      <MoneyAmount amountMinor={quote.totalMinor} currency={quote.currency} locale={locale} className="font-medium" />
    ),
  },
];

/** Under a quotation's customer on a phone, in place of the columns it leaves out. */
export function quoteSummary(locale: string) {
  return function QuoteSummary(quote: QuoteRow) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadge kind="quote" status={quote.status} />
        <span>{formatCalendarDate(quote.issueDate, locale)}</span>
      </span>
    );
  };
}

/** Bills that have been sent and not cancelled: the ones where "paid so far" means something. */
const showsPayment = (status: InvoiceRow["status"]) => status !== "DRAFT" && status !== "VOID" && status !== "CANCELLED";

export const invoiceColumns = (locale: string): DataColumn<InvoiceRow>[] => [
  {
    id: "customer",
    header: "Customer",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (invoice) => <Customer name={invoice.customerName} number={invoice.number} />,
  },
  {
    id: "due",
    header: "Due",
    width: "minmax(0,1.2fr)",
    hideBelow: "md",
    skeleton: ["md", "md"],
    cell: (invoice) => (
      <>
        <span className={invoice.status === "OVERDUE" ? "block truncate text-sm text-danger-strong" : "block truncate text-sm"}>
          {formatCalendarDate(invoice.dueDate, locale)}
        </span>
        <CellSub>Issued {formatCalendarDate(invoice.issueDate, locale)}</CellSub>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "9.5rem",
    skeleton: "sm",
    cell: (invoice) => <StatusBadge kind="invoice" status={invoice.status} />,
  },
  {
    id: "paid",
    header: "Paid",
    width: "minmax(0,1.5fr)",
    hideBelow: "lg",
    skeleton: ["sm", "md"],
    cell: (invoice) =>
      showsPayment(invoice.status) ? (
        <PaidProgress
          paidMinor={invoice.amountPaidMinor}
          totalMinor={invoice.totalMinor}
          currency={invoice.currency}
          locale={locale}
        />
      ) : (
        <CellSub>Nothing to pay</CellSub>
      ),
  },
  {
    id: "amount",
    header: "Amount",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (invoice) => (
      <MoneyAmount amountMinor={invoice.totalMinor} currency={invoice.currency} locale={locale} className="font-medium" />
    ),
  },
];

/** Under a billing statement's customer on a phone: its status and when it is due. */
export function invoiceSummary(locale: string) {
  return function InvoiceSummary(invoice: InvoiceRow) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadge kind="invoice" status={invoice.status} />
        <span>Due {formatCalendarDate(invoice.dueDate, locale)}</span>
      </span>
    );
  };
}

/** The quotation list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function QuoteListSkeleton({ label, strip = true }: { label: string; strip?: boolean }) {
  return <DataTableSkeleton label={label} columns={quoteColumns("en-PH")} summary controls={2} strip={strip} />;
}

/** The billing statement list's panel while its rows load. */
export function InvoiceListSkeleton({ label, strip = true }: { label: string; strip?: boolean }) {
  return <DataTableSkeleton label={label} columns={invoiceColumns("en-PH")} summary controls={2} strip={strip} />;
}
