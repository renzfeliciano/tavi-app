import { describe, expect, it } from "vitest";
import { escapeLikePattern, normalizeSearch } from "./search";

describe("normalizeSearch", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normalizeSearch("  dela   cruz ")).toBe("dela cruz");
    expect(normalizeSearch("x".repeat(500))).toHaveLength(100);
  });

  it("treats blank or missing input as no search", () => {
    expect(normalizeSearch("   ")).toBeNull();
    expect(normalizeSearch(undefined)).toBeNull();
    expect(normalizeSearch(["a", "b"])).toBe("a");
  });
});

describe("escapeLikePattern", () => {
  it("makes % _ and \\ match literally", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
