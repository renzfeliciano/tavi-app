import { ArrowRightIcon } from "lucide-react";
import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import type { PendingGroup } from "@/modules/payments";
import { formatCalendarDate } from "@/shared/dates/calendar";

const payments = (count: number) => `${count} ${count === 1 ? "payment" : "payments"}`;

/**
 * The customers still owing a certificate: one definition for the table and its skeleton. `certificate` is the
 * form's short name from the market profile ("2307").
 */
export const pendingColumns = (locale: string, certificate: string): DataColumn<PendingGroup>[] => [
  {
    id: "customer",
    header: "Customer",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (group) => (
      <>
        <CellTitle>{group.customerName}</CellTitle>
        <CellSub>{payments(group.paymentCount)}</CellSub>
      </>
    ),
  },
  {
    id: "oldest",
    header: "Oldest payment",
    width: "minmax(0,1.2fr)",
    hideBelow: "md",
    skeleton: "md",
    cell: (group) => <span className="block truncate text-sm">{formatCalendarDate(group.oldestPaidOn, locale)}</span>,
  },
  {
    id: "next",
    header: "Next step",
    width: "minmax(0,1.2fr)",
    hideBelow: "lg",
    skeleton: "md",
    cell: () => (
      <span className="flex items-center gap-1.5 text-sm font-medium">
        Record {certificate}
        <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </span>
    ),
  },
  {
    id: "tax",
    header: "Tax withheld",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (group) => <MoneyAmount amountMinor={group.withheldMinor} currency={group.currency} locale={locale} className="font-medium" />,
  },
];

/** Under a customer on a phone: how many payments, and since when. */
export const pendingSummaryLine = (locale: string) => (group: PendingGroup) =>
  `${payments(group.paymentCount)} · since ${formatCalendarDate(group.oldestPaidOn, locale)}`;

/** The panel while the waiting list loads (and while a page or a search does). */
export function PendingListSkeleton() {
  return <DataTableSkeleton label="Waiting list" columns={pendingColumns("en-PH", "2307")} controls={2} summary />;
}
