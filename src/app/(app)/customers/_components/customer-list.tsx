import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import { Monogram } from "@/components/monogram";
import { MARKETS, type MarketProfile } from "@/config/markets";
import type { CustomerRow } from "../_lib/figures";

export type { CustomerRow };

/**
 * The customer list's columns: one definition for the table and for its skeleton, so the two never drift.
 * The customer leads; what they owe is the one figure kept on a phone, opposite their name.
 */
export const customerColumns = (locale: string, market: Pick<MarketProfile, "documents">): DataColumn<CustomerRow>[] => [
  {
    id: "customer",
    header: "Customer",
    width: "minmax(0,2.2fr)",
    phone: "title",
    lead: "disc",
    skeleton: ["lg", "md"],
    cell: (customer) => (
      <span className="flex items-center gap-3">
        <Monogram name={customer.displayName} />
        <span className="min-w-0 flex-1">
          <CellTitle>{customer.displayName}</CellTitle>
          {customer.company && <CellSub>{customer.company}</CellSub>}
        </span>
      </span>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    width: "minmax(0,2fr)",
    hideBelow: "md",
    skeleton: ["lg", "md"],
    cell: (customer) =>
      customer.email || customer.phone ? (
        <>
          <span className="block truncate text-sm">{customer.email ?? customer.phone}</span>
          {customer.email && customer.phone && <CellSub>{customer.phone}</CellSub>}
        </>
      ) : (
        <CellSub>No contact details</CellSub>
      ),
  },
  {
    id: "activity",
    header: "Last activity",
    width: "minmax(0,1.3fr)",
    hideBelow: "lg",
    skeleton: ["sm", "md"],
    cell: ({ activity }) =>
      activity ? (
        <>
          <span className="block truncate text-sm">{activity.when}</span>
          <CellSub>{market.documents[activity.kind].singular}</CellSub>
        </>
      ) : (
        <CellSub>No activity yet</CellSub>
      ),
  },
  {
    id: "balance",
    header: "Balance",
    width: "9.5rem",
    align: "end",
    phone: "end",
    skeleton: ["sm", "xs"],
    cell: ({ owing }) =>
      owing.length === 0 ? (
        <CellSub>Nothing owed</CellSub>
      ) : (
        owing.map(({ currency, owedMinor, overdueMinor }) => (
          <span key={currency} className="block">
            <MoneyAmount amountMinor={owedMinor} currency={currency} locale={locale} className="block font-medium" />
            {overdueMinor > 0 ? (
              <span className="block truncate text-sm text-danger-strong">
                <MoneyAmount amountMinor={overdueMinor} currency={currency} locale={locale} /> overdue
              </span>
            ) : (
              <CellSub>Not due yet</CellSub>
            )}
          </span>
        ))
      ),
  },
];

/** What a phone shows under a customer's name, in place of the columns it leaves out. */
export const customerSummary = (customer: Pick<CustomerRow, "email" | "phone" | "city">) =>
  [customer.email ?? customer.phone ?? "No contact details", customer.city].filter(Boolean).join(" · ");

/** The customer list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function CustomerListSkeleton() {
  return <DataTableSkeleton label="Customer list" columns={customerColumns("en-PH", MARKETS.PH)} summary />;
}
