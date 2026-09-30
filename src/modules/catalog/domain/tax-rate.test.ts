import { describe, expect, it } from "vitest";
import { formatRate, parsePercentToBps, taxRateInputSchema } from "./tax-rate";

describe("parsePercentToBps", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["0.25", 25],
    ["0", 0],
    ["100", 10000],
    [" 3 ", 300],
    ["12%", 1200],
  ])("reads %s%% as %i basis points", (input, bps) => {
    expect(parsePercentToBps(input)).toBe(bps);
  });

  it.each(["", "abc", "-1", "100.01", "12.345", "1e2"])("rejects %s", (input) => {
    expect(parsePercentToBps(input)).toBeNull();
  });
});

describe("formatRate", () => {
  it("shows basis points as a short percentage", () => {
    expect(formatRate(1200)).toBe("12%");
    expect(formatRate(1250)).toBe("12.5%");
    expect(formatRate(25)).toBe("0.25%");
  });
});

describe("taxRateInputSchema", () => {
  it("parses a name and a percentage", () => {
    expect(taxRateInputSchema.parse({ name: " VAT ", rate: "12" })).toEqual({ name: "VAT", rateBps: 1200 });
  });

  it("explains invalid input", () => {
    const result = taxRateInputSchema.safeParse({ name: "", rate: "12.345" });
    expect(result.success).toBe(false);
    const errors = result.success ? {} : result.error.flatten().fieldErrors;
    expect(errors).toMatchObject({
      name: ["Give this tax a name."],
      rate: ["Enter a percentage from 0 to 100, with up to 2 decimals."],
    });
  });
});
