import { CatalogPrice } from "@/components/catalog-price";
import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { KIND_ICON } from "@/components/kind-icon";
import { CellSub, CellTitle } from "@/components/list-cells";
import type { CatalogItem, CatalogItemKind } from "@/modules/catalog";

/** A product or service's icon on a small tile: a wrench for work, a box for goods. */
function KindTile({ kind }: { kind: CatalogItemKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-sunken text-ink-subtle"
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * The catalog list's columns for one kind: one definition for the table and for its skeleton, so the two never
 * drift. Only products have a SKU, so only their list has that column.
 */
export const catalogColumns = (kind: CatalogItemKind, locale: string): DataColumn<CatalogItem>[] => [
  {
    id: "item",
    header: kind === "product" ? "Product" : "Service",
    width: "minmax(0,2.4fr)",
    phone: "title",
    lead: "tile",
    skeleton: ["lg", "md"],
    cell: (item) => (
      <span className="flex items-center gap-3">
        <KindTile kind={item.kind} />
        <span className="min-w-0 flex-1">
          <CellTitle>{item.name}</CellTitle>
          {item.description && <CellSub>{item.description}</CellSub>}
        </span>
      </span>
    ),
  },
  ...(kind === "product"
    ? [
        {
          id: "sku",
          header: "SKU",
          width: "minmax(0,1fr)",
          hideBelow: "md",
          skeleton: "sm",
          cell: (item: CatalogItem) =>
            item.sku ? <span className="block truncate font-mono text-sm">{item.sku}</span> : <CellSub>No SKU</CellSub>,
        } satisfies DataColumn<CatalogItem>,
      ]
    : []),
  {
    id: "price",
    header: "Price",
    width: "8.5rem",
    align: "end",
    phone: "end",
    skeleton: ["sm", "sm"],
    cell: (item) => (
      <span className="text-sm">
        <CatalogPrice priceMinor={item.unitPriceMinor} currency={item.currency} unitLabel={item.unitLabel} locale={locale} />
      </span>
    ),
  },
];

/** The catalog list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function CatalogListSkeleton({ kind }: { kind: CatalogItemKind }) {
  return <DataTableSkeleton label={`${kind === "product" ? "Products" : "Services"} list`} columns={catalogColumns(kind, "en-PH")} controls={2} />;
}
