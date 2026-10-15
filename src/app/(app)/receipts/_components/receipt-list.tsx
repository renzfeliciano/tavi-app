import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { DocumentNumber } from "@/components/document-number";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import { MARKETS, type MarketProfile } from "@/config/markets";
import type { ReceiptList } from "@/modules/payments";
import { formatCalendarDate } from "@/shared/dates/calendar";

export type ReceiptRow = ReceiptList["receipts"][number];

type Market = Pick<MarketProfile, "documents">;

/** The receipt list's columns: one definition for the table and its skeleton, so the two never drift. */
export const receiptColumns = (locale: string, market: Market): DataColumn<ReceiptRow>[] => [
  {
    id: "payer",
    header: "Received from",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (receipt) => (
      <>
        <CellTitle>{receipt.payerName}</CellTitle>
        <CellSub>
          <DocumentNumber number={receipt.receiptNumber} />
          {receipt.voidedAt && " · Voided"}
        </CellSub>
      </>
    ),
  },
  {
    id: "purpose",
    header: "For",
    width: "minmax(0,1.6fr)",
    hideBelow: "md",
    skeleton: "md",
    cell: (receipt) => <span className="block truncate text-sm">{receipt.purpose}</span>,
  },
  {
    id: "received",
    header: "Received",
    width: "minmax(0,1.6fr)",
    hideBelow: "md",
    skeleton: ["md", "md"],
    cell: (receipt) => (
      <>
        <span className="block truncate text-sm">{formatCalendarDate(receipt.receivedOn, locale)}</span>
        <CellSub>{market.documents.receiptKinds[receipt.kind].title}</CellSub>
      </>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (receipt) => (
      <MoneyAmount
        amountMinor={receipt.amountMinor}
        currency={receipt.currency}
        locale={locale}
        className={receipt.voidedAt ? "text-muted-foreground line-through" : "font-medium"}
      />
    ),
  },
];

/** Under a receipt's payer on a phone: when, which kind and what for. */
export const receiptSummary = (locale: string, market: Market) => (receipt: ReceiptRow) =>
  [formatCalendarDate(receipt.receivedOn, locale), market.documents.receiptKinds[receipt.kind].title, receipt.purpose].join(" · ");

/** The receipt list's panel while its rows load: the loading screen's, and what stands in for the rows while a page or search loads. */
export function ReceiptListSkeleton() {
  return <DataTableSkeleton label="Receipt list" columns={receiptColumns("en-PH", MARKETS.PH)} controls={2} summary />;
}
