/** Longest search we run; anything beyond is noise. */
export const MAX_SEARCH_LENGTH = 100;

/** A search box value (or `?q=` param) ready to query with, or null for "no search". */
export function normalizeSearch(input: string | string[] | undefined): string | null {
  const raw = Array.isArray(input) ? input[0] : input;
  const text = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_SEARCH_LENGTH);
  return text === "" ? null : text;
}

/** Escapes LIKE/ILIKE wildcards so user text matches literally (use with the default `\` escape). */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
