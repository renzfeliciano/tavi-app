import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantityInput, QUANTITY_SCALE } from "./quantity";

describe("parseQuantityInput", () => {
  it.each([
    ["1", 1 * QUANTITY_SCALE],
    ["1.5", 1.5 * QUANTITY_SCALE],
    ["0.25", 2500],
    ["2,000", 2000 * QUANTITY_SCALE],
    ["0.0001", 1],
  ])("reads %j as %i ten-thousandths", (input, scaled) => {
    expect(parseQuantityInput(input, "en-PH")).toBe(scaled);
  });

  it("follows the locale", () => {
    expect(parseQuantityInput("1,5", "de-DE")).toBe(15_000);
  });

  it.each(["0", "0.0000", "", "-1", "1.00001", "1000000", "abc"])("rejects %j", (input) => {
    expect(parseQuantityInput(input, "en-PH")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("shows only the decimals a quantity has, in the locale's format", () => {
    expect(formatQuantity(15_000, "en-PH")).toBe("1.5");
    expect(formatQuantity(10_000, "en-PH")).toBe("1");
    expect(formatQuantity(12_345_678, "en-PH")).toBe("1,234.5678");
    expect(formatQuantity(15_000, "de-DE")).toBe("1,5");
  });

  it("round-trips through parseQuantityInput", () => {
    for (const scaled of [1, 2500, 15_000, 12_345_678, 9_999_999_999]) {
      expect(parseQuantityInput(formatQuantity(scaled, "en-PH"), "en-PH")).toBe(scaled);
    }
  });
});
