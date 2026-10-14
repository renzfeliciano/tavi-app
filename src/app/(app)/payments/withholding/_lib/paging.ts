import { type PageMeta, pageMeta, pageWindow } from "@/shared/pagination/page-window";

// The Withholding page's lists come whole from their queries (a business has a few
// certificates a quarter), so the page cuts them into the same pages, with the same
// footer, as every other list (DESIGN.md, "Lists and records").

/** One page of a list held in memory, with the range the footer reports. */
export function pageOf<T>(items: readonly T[], { page, pageSize }: { page: number; pageSize?: number }): { rows: T[]; meta: PageMeta } {
  const window = pageWindow({ page, pageSize, matching: items.length });
  return { rows: items.slice(window.offset, window.offset + window.pageSize), meta: pageMeta(window) };
}

const fold = (text: string) => text.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();

/** Whether any of the texts contains what was typed, ignoring case and accents; everything matches an empty search. */
export function matchesSearch(texts: readonly (string | null | undefined)[], search: string | null): boolean {
  if (!search) return true;
  const needle = fold(search);
  return texts.some((text) => text != null && fold(text).includes(needle));
}
