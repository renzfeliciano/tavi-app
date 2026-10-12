import { describe, expect, it } from "vitest";
import { parseIdempotencyKey } from "./idempotency";

describe("parseIdempotencyKey", () => {
  it("accepts a UUID or a short token and trims it", () => {
    expect(parseIdempotencyKey(" 3f0c5a52-9b1e-4d3a-8f55-2d1f0a7c9e11 ")).toBe("3f0c5a52-9b1e-4d3a-8f55-2d1f0a7c9e11");
    expect(parseIdempotencyKey("retry_key-0001")).toBe("retry_key-0001");
  });

  it("means 'no key' for a missing or blank value", () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey(null)).toBeNull();
    expect(parseIdempotencyKey("   ")).toBeNull();
  });

  it("refuses keys that are too short, too long or carry odd characters", () => {
    expect(parseIdempotencyKey("abc")).toBe(false);
    expect(parseIdempotencyKey("x".repeat(81))).toBe(false);
    expect(parseIdempotencyKey("has spaces in it ok")).toBe(false);
    expect(parseIdempotencyKey("semi;colon;;;;")).toBe(false);
  });
});
