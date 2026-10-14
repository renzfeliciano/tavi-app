import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import type { CertificateSummary } from "@/modules/payments";
import { quarterOf } from "@/modules/payments/client";
import { type CalendarDate, formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";

export type CertificateRow = CertificateSummary;

/** "Q3 2026": the calendar quarter of the period's first day, which is what the quarterly report groups by. */
export function quarterLabel(periodFrom: CalendarDate): string {
  const { year, quarter } = quarterOf(periodFrom);
  return `Q${quarter} ${year}`;
}

/** "Matches" or "Differs by ₱5.00": the form's total against the tax withheld on the payments it covers. */
export const checkText = (row: CertificateRow, locale: string) =>
  row.reconciliation.matches ? "Matches" : `Differs by ${formatMoney(Math.abs(row.reconciliation.differenceMinor), row.currency, { locale })}`;

/** The certificate list's columns: one definition for the table and its skeleton, so the two never drift. */
export const certificateColumns = (locale: string): DataColumn<CertificateRow>[] => [
  {
    id: "payor",
    header: "Payor",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (row) => (
      <>
        <CellTitle>{row.payorName}</CellTitle>
        <CellSub>
          {quarterLabel(row.periodFrom)} · {row.atcCodes.join(", ")}
          {row.voidedAt && " · Void"}
        </CellSub>
      </>
    ),
  },
  {
    id: "received",
    header: "Received",
    width: "minmax(0,1.2fr)",
    hideBelow: "md",
    skeleton: ["md", "sm"],
    cell: (row) => (
      <>
        <span className="block truncate text-sm">{formatCalendarDate(row.receivedOn, locale)}</span>
        <CellSub>{row.hasScan ? "Scan attached" : "No scan"}</CellSub>
      </>
    ),
  },
  {
    id: "check",
    header: "Payments",
    width: "minmax(0,1.4fr)",
    hideBelow: "lg",
    skeleton: ["md", "sm"],
    cell: (row) => {
      const Icon = row.reconciliation.matches ? CircleCheckIcon : CircleAlertIcon;
      return (
        <>
          <span className="flex items-center gap-1.5 text-sm">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            <span className="truncate">{checkText(row, locale)}</span>
          </span>
          <CellSub>
            {row.linkedCount} {row.linkedCount === 1 ? "payment" : "payments"} linked
          </CellSub>
        </>
      );
    },
  },
  {
    id: "tax",
    header: "Tax withheld",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (row) => (
      <MoneyAmount
        amountMinor={row.taxWithheldMinor}
        currency={row.currency}
        locale={locale}
        className={row.voidedAt ? "text-muted-foreground line-through" : "font-medium"}
      />
    ),
  },
];

/** Under a certificate's payor on a phone: the quarter, when it arrived and whether the payments add up. */
export const certificateSummaryLine = (locale: string) => (row: CertificateRow) =>
  [
    quarterLabel(row.periodFrom),
    `received ${formatCalendarDate(row.receivedOn, locale)}`,
    checkText(row, locale),
    row.voidedAt ? "Void" : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** The panel while certificates load (and while a page or a search does). */
export function CertificateListSkeleton() {
  return <DataTableSkeleton label="Certificate list" columns={certificateColumns("en-PH")} controls={2} summary />;
}
