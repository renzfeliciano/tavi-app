import { describe, expect, it } from "vitest";
import { formatRate, formatRateForInput, parsePercentToBps, taxRateInputSchemaFor } from "./tax-rate";

describe("parsePercentToBps", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["0.25", 25],
    ["0", 0],
    ["100", 10000],
    [" 3 ", 300],
    ["12%", 1200],
    ["12 %", 1200],
  ])("reads %s%% as %i basis points", (input, bps) => {
    expect(parsePercentToBps(input, "en-PH")).toBe(bps);
  });

  it.each(["", "abc", "-1", "100.01", "12.345", "1e2"])("rejects %s", (input) => {
    expect(parsePercentToBps(input, "en-PH")).toBeNull();
  });

  it("reads the locale's decimal separator", () => {
    expect(parsePercentToBps("19,5", "de-DE")).toBe(1950);
  });
});

describe("formatRate", () => {
  it("shows basis points as a short percentage in the locale's format", () => {
    expect(formatRate(1200, "en-PH")).toBe("12%");
    expect(formatRate(1250, "en-PH")).toBe("12.5%");
    expect(formatRate(25, "en-PH")).toBe("0.25%");
    expect(formatRate(1950, "de-DE")).toBe("19,5 %");
  });

  it("writes a rate back the way the parser reads it", () => {
    for (const [bps, locale] of [
      [1250, "en-PH"],
      [1950, "de-DE"],
      [10_000, "en-PH"],
    ] as const) {
      expect(parsePercentToBps(formatRateForInput(bps, locale), locale)).toBe(bps);
    }
    expect(formatRateForInput(1250, "en-PH")).toBe("12.5");
  });
});

describe("taxRateInputSchemaFor", () => {
  const schema = taxRateInputSchemaFor("en-PH");

  it("parses a name and a percentage", () => {
    expect(schema.parse({ name: " VAT ", rate: "12" })).toEqual({ name: "VAT", rateBps: 1200 });
  });

  it("explains invalid input", () => {
    const result = schema.safeParse({ name: "", rate: "12.345" });
    expect(result.success).toBe(false);
    const errors = result.success ? {} : result.error.flatten().fieldErrors;
    expect(errors).toMatchObject({
      name: ["Give this tax a name."],
      rate: ["Enter a percentage from 0 to 100, with up to 2 decimals."],
    });
  });
});
