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
