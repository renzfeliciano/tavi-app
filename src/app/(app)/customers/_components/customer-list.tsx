import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { Monogram } from "@/components/monogram";
import type { CustomerList } from "@/modules/customers";

export type CustomerRow = CustomerList["customers"][number];

/** The customer list's columns: one definition for the table and for its skeleton, so the two never drift. */
export const customerColumns: DataColumn<CustomerRow>[] = [
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
    id: "city",
    header: "City",
    width: "minmax(0,1fr)",
    hideBelow: "md",
    skeleton: "sm",
    cell: (customer) => <CellSub>{customer.city}</CellSub>,
  },
];

/** What a phone shows under a customer's name, in place of the columns it leaves out. */
export const customerSummary = (customer: CustomerRow) =>
  [customer.email ?? customer.phone ?? "No contact details", customer.city].filter(Boolean).join(" · ");

/** The customer list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function CustomerListSkeleton() {
  return <DataTableSkeleton label="Customer list" columns={customerColumns} summary />;
}
