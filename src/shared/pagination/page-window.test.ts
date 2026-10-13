import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, describeRange, pageMeta, pageWindow, parsePageSize } from "./page-window";

describe("parsePageSize", () => {
  it("accepts every size in the set, as text or number", () => {
    for (const size of PAGE_SIZES) {
      expect(parsePageSize(String(size))).toBe(size);
      expect(parsePageSize(size)).toBe(size);
    }
  });

  it("falls back to the default for anything else", () => {
    for (const bad of [undefined, null, "", "abc", "0", "-25", "7", "26", "1e2", "25.5", 7, 0, -25, NaN, [], {}]) {
      expect(parsePageSize(bad)).toBe(DEFAULT_PAGE_SIZE);
    }
  });

  it("takes the first value of a repeated param", () => {
    expect(parsePageSize(["50", "10"])).toBe(50);
    expect(parsePageSize(["huge", "50"])).toBe(DEFAULT_PAGE_SIZE);
  });

  it("has a default that is one of the sizes", () => {
    expect(PAGE_SIZES).toContain(DEFAULT_PAGE_SIZE);
  });
});

describe("pageWindow", () => {
  it("describes the first page", () => {
    expect(pageWindow({ page: 1, pageSize: 25, matching: 143 })).toEqual({
      page: 1,
      pageSize: 25,
      pageCount: 6,
      offset: 0,
      from: 1,
      to: 25,
      matching: 143,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("describes a middle page and the short last page", () => {
    expect(pageWindow({ page: 2, pageSize: 25, matching: 143 })).toMatchObject({ offset: 25, from: 26, to: 50, hasPrevious: true, hasNext: true });
    expect(pageWindow({ page: 6, pageSize: 25, matching: 143 })).toMatchObject({ offset: 125, from: 126, to: 143, hasPrevious: true, hasNext: false });
  });

  it("fits exactly when the rows fill the last page", () => {
    expect(pageWindow({ page: 2, pageSize: 25, matching: 50 })).toMatchObject({ pageCount: 2, from: 26, to: 50, hasNext: false });
  });

  it("has one empty page when nothing matches", () => {
    expect(pageWindow({ page: 1, pageSize: 25, matching: 0 })).toMatchObject({
      page: 1,
      pageCount: 1,
      offset: 0,
      from: 0,
      to: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it("brings a page past the end back to the last page", () => {
    expect(pageWindow({ page: 99, pageSize: 25, matching: 143 })).toMatchObject({ page: 6, from: 126, to: 143 });
    expect(pageWindow({ page: 3, pageSize: 25, matching: 0 })).toMatchObject({ page: 1, from: 0, to: 0 });
  });

  it("takes a page below 1 or a fraction as the first page", () => {
    expect(pageWindow({ page: 0, pageSize: 25, matching: 143 }).page).toBe(1);
    expect(pageWindow({ page: -4, pageSize: 25, matching: 143 }).page).toBe(1);
    expect(pageWindow({ page: 2.7, pageSize: 25, matching: 143 }).page).toBe(2);
    expect(pageWindow({ page: Number.NaN, pageSize: 25, matching: 143 }).page).toBe(1);
  });

  it("never trusts a size outside the set", () => {
    expect(pageWindow({ page: 1, pageSize: 7, matching: 143 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(pageWindow({ page: 1, pageSize: 100000, matching: 143 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("describeRange", () => {
  const noun = { singular: "customer", plural: "customers" };

  it("says which rows are shown out of how many", () => {
    expect(describeRange({ from: 26, to: 50, matching: 143 }, noun)).toBe("Showing 26–50 of 143 customers");
    expect(describeRange({ from: 1, to: 25, matching: 25 }, noun)).toBe("Showing 1–25 of 25 customers");
  });

  it("says it plainly for one and for none", () => {
    expect(describeRange({ from: 1, to: 1, matching: 1 }, noun)).toBe("Showing 1 customer");
    expect(describeRange({ from: 0, to: 0, matching: 0 }, noun)).toBe("No customers");
  });

  it("groups thousands", () => {
    expect(describeRange({ from: 1001, to: 1100, matching: 2345 }, noun)).toBe("Showing 1,001–1,100 of 2,345 customers");
  });
});

describe("pageMeta", () => {
  it("is what a list returns beside its rows, without the query's offset", () => {
    expect(pageMeta(pageWindow({ page: 2, pageSize: 25, matching: 143 }))).toEqual({
      page: 2,
      pageSize: 25,
      pageCount: 6,
      from: 26,
      to: 50,
      matching: 143,
      hasMore: true,
    });
  });

  it("says there is no more on the last page", () => {
    expect(pageMeta(pageWindow({ page: 6, pageSize: 25, matching: 143 })).hasMore).toBe(false);
  });
});
