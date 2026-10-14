import { describe, expect, it } from "vitest";
import { matchesSearch, pageOf } from "./paging";

describe("pageOf", () => {
  const items = Array.from({ length: 60 }, (_, i) => i + 1);

  it("cuts a list into pages of the chosen size, with the range the footer says", () => {
    const first = pageOf(items, { page: 1, pageSize: 25 });
    expect(first.rows).toHaveLength(25);
    expect(first.rows[0]).toBe(1);
    expect(first.meta).toMatchObject({ page: 1, pageCount: 3, from: 1, to: 25, matching: 60, hasMore: true });

    const last = pageOf(items, { page: 3, pageSize: 25 });
    expect(last.rows).toEqual(items.slice(50));
    expect(last.meta).toMatchObject({ from: 51, to: 60, hasMore: false });
  });

  it("brings a page that is too high back to the last one, and an empty list to page 1", () => {
    expect(pageOf(items, { page: 99, pageSize: 25 }).meta.page).toBe(3);
    const none = pageOf([], { page: 4, pageSize: 25 });
    expect(none.rows).toEqual([]);
    expect(none.meta).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0, matching: 0 });
  });
});

describe("matchesSearch", () => {
  it("finds a word anywhere in any of the texts, ignoring case and accents", () => {
    expect(matchesSearch(["Dela Cruz Trading", "987-654-321-000"], "cruz")).toBe(true);
    expect(matchesSearch(["Peñaflor Foods"], "penaflor")).toBe(true);
    expect(matchesSearch(["Dela Cruz Trading", null], "321")).toBe(false);
    expect(matchesSearch(["Dela Cruz Trading", "987-654-321-000"], "321")).toBe(true);
  });

  it("matches everything when nothing was typed", () => {
    expect(matchesSearch(["anything"], null)).toBe(true);
    expect(matchesSearch([], "")).toBe(true);
  });
});
