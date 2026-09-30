import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "./decimal-input";

const opts = (scale: number, maxWholeDigits = 12) => ({ locale: "en-PH", scale, maxWholeDigits });

describe("parseDecimalInput", () => {
  it.each([
    ["1.5", 4, 15_000],
    ["2", 4, 20_000],
    ["0.0001", 4, 1],
    ["1,250.5", 2, 125_050],
    ["12", 0, 12],
  ])("reads %j at scale %i as %i", (input, scale, expected) => {
    expect(parseDecimalInput(input, opts(scale))).toBe(expected);
  });

  it("follows the locale's separators", () => {
    expect(parseDecimalInput("1.250,5", { locale: "de-DE", scale: 2, maxWholeDigits: 12 })).toBe(125_050);
  });

  it.each(["", "-1", "1.00001", "abc", "1e3", "1..2"])("rejects %j", (input) => {
    expect(parseDecimalInput(input, opts(4))).toBeNull();
  });

  it("caps the whole part", () => {
    expect(parseDecimalInput("999999", opts(4, 6))).toBe(9_999_990_000);
    expect(parseDecimalInput("1000000", opts(4, 6))).toBeNull();
  });
});
