import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { DocumentNumber } from "@/components/document-number";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import { MARKETS, type MarketProfile } from "@/config/markets";
import type { PaymentList } from "@/modules/payments";
import type { WithholdingStatus } from "@/modules/payments/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { WithholdingBadge } from "./withholding-badge";

export type PaymentRow = PaymentList["payments"][number];

/** Who paid: the customer on the billing statement, else whoever was written down as the payer. */
const payer = (payment: PaymentRow) => payment.customerName ?? payment.payerName ?? "Unknown payer";

/** "GCash · GC-1": how it was paid and the reference that was written down. */
const how = (payment: PaymentRow, market: Pick<MarketProfile, "paymentMethodLabels">) =>
  [market.paymentMethodLabels[payment.method], payment.reference].filter(Boolean).join(" · ");

/**
 * The payment list's columns: one definition for the table and for its skeleton, so the two never drift.
 * `withholding` says which payments still wait for a 2307 (the badge sits on the receipt line, which keeps the row's height).
 */
export const paymentColumns = (
  locale: string,
  market: Pick<MarketProfile, "paymentMethodLabels" | "taxWithheld">,
  withholding?: ReadonlyMap<string, WithholdingStatus>,
): DataColumn<PaymentRow>[] => [
  {
    id: "payer",
    header: "Received from",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (payment) => (
      <>
        <CellTitle>{payer(payment)}</CellTitle>
        <CellSub className="flex items-center gap-2">
          <span className="min-w-0 truncate">
            <DocumentNumber number={payment.receiptNumber} />
            {payment.voidedAt && " · Voided"}
          </span>
          {!payment.voidedAt && market.taxWithheld && (
            <WithholdingBadge
              status={withholding?.get(payment.id) ?? "none"}
              certificate={market.taxWithheld.certificate.short}
              compact
              className="shrink-0"
            />
          )}
        </CellSub>
      </>
    ),
  },
  {
    id: "invoice",
    header: "For",
    width: "minmax(0,1.2fr)",
    hideBelow: "md",
    skeleton: "md",
    cell: (payment) =>
      payment.invoiceNumber ? <DocumentNumber number={payment.invoiceNumber} className="text-sm" /> : <CellSub>Draft</CellSub>,
  },
  {
    id: "paid",
    header: "Paid",
    width: "minmax(0,1.6fr)",
    hideBelow: "md",
    skeleton: ["md", "md"],
    cell: (payment) => (
      <>
        <span className="block truncate text-sm">{formatCalendarDate(payment.paidOn, locale)}</span>
        <CellSub>{how(payment, market)}</CellSub>
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
    cell: (payment) => (
      <MoneyAmount
        amountMinor={payment.amountMinor}
        currency={payment.currency}
        locale={locale}
        className={payment.voidedAt ? "text-muted-foreground line-through" : "font-medium"}
      />
    ),
  },
];

/** Under a payment's payer on a phone: when, how and for which bill. */
export const paymentSummary =
  (locale: string, market: Pick<MarketProfile, "paymentMethodLabels">) => (payment: PaymentRow) =>
    [formatCalendarDate(payment.paidOn, locale), how(payment, market), payment.invoiceNumber].filter(Boolean).join(" · ");

/** The payment list's panel while its rows load: the loading screen's, and what stands in for the rows while a page or search loads. */
export function PaymentListSkeleton() {
  return <DataTableSkeleton label="Payment list" columns={paymentColumns("en-PH", MARKETS.PH)} controls={2} summary strip />;
}
