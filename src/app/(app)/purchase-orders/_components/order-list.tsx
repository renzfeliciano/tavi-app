import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import { StatusBadge } from "@/components/status/status-badge";
import { MARKETS } from "@/config/markets";
import type { PurchaseOrderSummary } from "@/modules/purchasing";
import { formatCalendarDate } from "@/shared/dates/calendar";

export type OrderRow = PurchaseOrderSummary;

/** The purchase order list's columns: one definition for the table and its skeleton, so the two never drift. */
export const orderColumns = (locale: string): DataColumn<OrderRow>[] => [
  {
    id: "supplier",
    header: "Supplier",
    width: "minmax(0,2fr)",
    phone: "title",
    skeleton: ["lg", "md"],
    cell: (order) => (
      <>
        <CellTitle>{order.supplierName ?? "No supplier yet"}</CellTitle>
        <CellSub>{order.number ?? "Draft"}</CellSub>
      </>
    ),
  },
  {
    id: "dates",
    header: "Ordered",
    width: "minmax(0,1.6fr)",
    hideBelow: "md",
    skeleton: ["md", "md"],
    cell: (order) => (
      <>
        <span className="block truncate text-sm">{formatCalendarDate(order.orderDate, locale)}</span>
        {order.status === "RECEIVED" && order.receivedDate ? (
          <CellSub>{`Received ${formatCalendarDate(order.receivedDate, locale)}`}</CellSub>
        ) : (
          order.expectedDate && <CellSub>{`Expected ${formatCalendarDate(order.expectedDate, locale)}`}</CellSub>
        )}
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "8.5rem",
    skeleton: "md",
    cell: (order) => <StatusBadge kind="purchase_order" status={order.status} />,
  },
  {
    id: "amount",
    header: "Amount",
    width: "9rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (order) => (
      <MoneyAmount
        amountMinor={order.totalMinor}
        currency={order.currency}
        locale={locale}
        className={order.status === "CANCELLED" ? "text-muted-foreground line-through" : "font-medium"}
      />
    ),
  },
];

/** Under a supplier's name on a phone: its status in words, then when it was ordered and when it is expected. */
export const orderSummary = (locale: string) =>
  function OrderSummary(order: OrderRow) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadge kind="purchase_order" status={order.status} />
        <span>{`Ordered ${formatCalendarDate(order.orderDate, locale)}`}</span>
        {order.expectedDate && <span>{`Expected ${formatCalendarDate(order.expectedDate, locale)}`}</span>}
      </span>
    );
  };

/** The list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function OrderListSkeleton() {
  return <DataTableSkeleton label="Purchase order list" columns={orderColumns(MARKETS.PH.locale)} controls={2} summary />;
}
