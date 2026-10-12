import { describe, expect, it } from "vitest";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, THEMES, htmlThemeAttribute, parseTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts the three choices", () => {
    for (const theme of THEMES) expect(parseTheme(theme)).toBe(theme);
  });

  it("follows the system for anything missing or unknown", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("midnight")).toBe("system");
    expect(parseTheme("DARK")).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme(42)).toBe("system");
  });
});

describe("htmlThemeAttribute", () => {
  it("pins the page only for an explicit choice; the system choice leaves it to the browser", () => {
    expect(htmlThemeAttribute("light")).toBe("light");
    expect(htmlThemeAttribute("dark")).toBe("dark");
    expect(htmlThemeAttribute("system")).toBeUndefined();
  });
});

describe("cookie", () => {
  it("is a named preference kept for a year", () => {
    expect(THEME_COOKIE).toBe("tavi-theme");
    expect(THEME_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});
