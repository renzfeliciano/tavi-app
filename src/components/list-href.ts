import type { Route } from "next";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination/page-window";

/** Builds a list URL from its params, leaving out empty and default ones. */
export function listHref(path: string, params: Record<string, string | number | null | undefined>): Route {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(name, String(value));
  }
  const query = search.toString();
  return (query ? `${path}?${query}` : path) as Route;
}

/**
 * The URL of a page or page size of a list: `params` (the search, the view…) are kept, page 1 and the default
 * size are left out, and changing the size starts again at page 1. `currentSize` is the size being viewed.
 */
export function pagedHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  currentSize: number = DEFAULT_PAGE_SIZE,
) {
  return ({ page = 1, size = currentSize }: { page?: number; size?: number }): Route =>
    listHref(path, { ...params, page: page > 1 ? page : null, size: size === DEFAULT_PAGE_SIZE ? null : size });
}

/** A list's `size` param for its tabs and filters: the size in use, left out when it is the default. */
export const sizeParam = (size: number) => (size === DEFAULT_PAGE_SIZE ? null : size);

/** The same for `ListSearch`'s `keep`, which takes strings. */
export const keptSize = (size: number) => (size === DEFAULT_PAGE_SIZE ? undefined : String(size));
