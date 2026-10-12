// The colour theme (D24): a per-device choice kept in a plain preference cookie,
// read on the server so the very first paint is already right. "system" follows
// the browser's own setting through CSS (prefers-color-scheme), so it needs no
// script; "light" and "dark" pin the page with a data-theme attribute on <html>.
// Customer pages, PDFs, the document sheet and the mascot are always light.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "tavi-theme";
/** A year, in seconds. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** What a stored or posted value means; anything unknown follows the system. */
export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : "system";
}

/** The `data-theme` for <html>: only an explicit choice pins the page. */
export function htmlThemeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
