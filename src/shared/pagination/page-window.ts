// The one place that decides how a list is cut into pages. Every list takes
// its page size from PAGE_SIZES (named here, never a literal in a page or a
// query) and its position from pageWindow, so a view's `?page=` and `?size=`
// mean the same on every list and a bad value can never reach the database.

/** The page sizes a list offers. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** The size a list uses when `?size=` is missing or isn't one of PAGE_SIZES. */
export const DEFAULT_PAGE_SIZE: PageSize = 25;

const isPageSize = (value: number): value is PageSize => (PAGE_SIZES as readonly number[]).includes(value);

/** A `?size=` param (or a number) as one of PAGE_SIZES; anything else is the default. */
export function parsePageSize(value: unknown): PageSize {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string" && typeof first !== "number") return DEFAULT_PAGE_SIZE;
  const size = typeof first === "number" ? first : /^\d+$/.test(first) ? Number(first) : Number.NaN;
  return isPageSize(size) ? size : DEFAULT_PAGE_SIZE;
}

export type PageWindow = {
  /** The page shown (1-based), brought back into range. */
  page: number;
  pageSize: PageSize;
  pageCount: number;
  /** Rows to skip in the query. */
  offset: number;
  /** First and last row shown, 1-based; both 0 when nothing matches. */
  from: number;
  to: number;
  /** Rows that match the search and view, across all pages. */
  matching: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/** Where a requested page falls among `matching` rows: clamped to the last page, never below the first. */
export function pageWindow({ page, pageSize, matching }: { page: number; pageSize?: number; matching: number }): PageWindow {
  const size = parsePageSize(pageSize);
  const pageCount = Math.max(1, Math.ceil(matching / size));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(requested, 1), pageCount);
  const offset = (current - 1) * size;
  return {
    page: current,
    pageSize: size,
    pageCount,
    offset,
    from: matching === 0 ? 0 : offset + 1,
    to: Math.min(matching, offset + size),
    matching,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}

/** "Showing 26–50 of 143 customers", "Showing 1 customer" or "No customers". */
export function describeRange(
  { from, to, matching }: Pick<PageWindow, "from" | "to" | "matching">,
  noun: { singular: string; plural: string },
  locale = "en",
): string {
  const n = new Intl.NumberFormat(locale);
  if (matching === 0) return `No ${noun.plural}`;
  if (matching === 1) return `Showing 1 ${noun.singular}`;
  return `Showing ${n.format(from)}–${n.format(to)} of ${n.format(matching)} ${noun.plural}`;
}

/** What a list returns beside its rows so its pager and count need nothing else. */
export type PageMeta = Pick<PageWindow, "page" | "pageSize" | "pageCount" | "from" | "to" | "matching"> & { hasMore: boolean };

export function pageMeta({ page, pageSize, pageCount, from, to, matching, hasNext }: PageWindow): PageMeta {
  return { page, pageSize, pageCount, from, to, matching, hasMore: hasNext };
}
