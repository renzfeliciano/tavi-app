import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { Monogram } from "@/components/monogram";
import type { SupplierSummary } from "@/modules/purchasing";

/**
 * The supplier list's columns: one definition for the table and for its skeleton, so the two never drift.
 * The supplier leads; the person to ask for sits under the name.
 */
export const supplierColumns = (): DataColumn<SupplierSummary>[] => [
  {
    id: "supplier",
    header: "Supplier",
    width: "minmax(0,2.2fr)",
    phone: "title",
    lead: "disc",
    skeleton: ["lg", "md"],
    cell: (supplier) => (
      <span className="flex items-center gap-3">
        <Monogram name={supplier.displayName} />
        <span className="min-w-0 flex-1">
          <CellTitle>{supplier.displayName}</CellTitle>
          {supplier.contactName && <CellSub>{supplier.contactName}</CellSub>}
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
    cell: (supplier) =>
      supplier.email || supplier.phone ? (
        <>
          <span className="block truncate text-sm">{supplier.email ?? supplier.phone}</span>
          {supplier.email && supplier.phone && <CellSub>{supplier.phone}</CellSub>}
        </>
      ) : (
        <CellSub>No contact details</CellSub>
      ),
  },
  {
    id: "city",
    header: "City",
    width: "minmax(0,1.2fr)",
    hideBelow: "lg",
    skeleton: "md",
    cell: (supplier) => (supplier.city ? <span className="block truncate text-sm">{supplier.city}</span> : <CellSub>Not set</CellSub>),
  },
];

/** What a phone shows under a supplier's name, in place of the columns it leaves out. */
export const supplierSummary = (supplier: Pick<SupplierSummary, "email" | "phone" | "city">) =>
  [supplier.email ?? supplier.phone ?? "No contact details", supplier.city].filter(Boolean).join(" · ");

/** The supplier list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function SupplierListSkeleton() {
  return <DataTableSkeleton label="Supplier list" columns={supplierColumns()} summary />;
}
