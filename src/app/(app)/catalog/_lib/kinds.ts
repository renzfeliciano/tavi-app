import type { Route } from "next";
import type { CatalogItemKind } from "@/modules/catalog/client";

// URL segments and on-screen names for the two catalog lists (D8).

export const KIND_SEGMENT = { product: "products", service: "services" } as const satisfies Record<
  CatalogItemKind,
  string
>;

export const KIND_LABEL = {
  product: { singular: "product", title: "Product", plural: "Products" },
  service: { singular: "service", title: "Service", plural: "Services" },
} as const satisfies Record<CatalogItemKind, { singular: string; title: string; plural: string }>;

/** "products" → "product"; anything else → null (a 404). */
export function kindFromSegment(segment: string): CatalogItemKind | null {
  if (segment === KIND_SEGMENT.product) return "product";
  if (segment === KIND_SEGMENT.service) return "service";
  return null;
}

export const itemHref = (kind: CatalogItemKind, id: string) => `/catalog/${KIND_SEGMENT[kind]}/${id}` as Route;
export const newItemHref = (kind: CatalogItemKind) => `/catalog/${KIND_SEGMENT[kind]}/new` as Route;

/** The tabs on the catalog page, in the order of its title, Products & Services. */
export const KIND_TABS: readonly CatalogItemKind[] = ["product", "service"];

/**
 * The tab the page opens on when the link doesn't name one: the first tab, unless the business has no products
 * and does have services, so a business that sells only its time never lands on an empty tab.
 */
export function startingKind(counts: Record<CatalogItemKind, number>): CatalogItemKind {
  return counts.product === 0 && counts.service > 0 ? "service" : KIND_TABS[0] ?? "product";
}
