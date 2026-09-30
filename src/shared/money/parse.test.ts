import { describe, expect, it } from "vitest";
import { formatAmountForInput, MAX_AMOUNT_WHOLE_DIGITS, parseMoneyInput } from "./parse";

describe("parseMoneyInput", () => {
  it.each([
    ["1250", 125_000],
    ["1,250.50", 125_050],
    ["1250.5", 125_050],
    [" 0.05 ", 5],
    ["0", 0],
    [".5", 50],
    ["1 250.50", 125_050],
  ])("reads %j in PHP as %i centavos", (input, minor) => {
    expect(parseMoneyInput(input, "PHP", "en-PH")).toBe(minor);
  });

  it("follows the currency's decimals", () => {
    expect(parseMoneyInput("1,250", "JPY", "ja-JP")).toBe(1250);
    expect(parseMoneyInput("1250.5", "JPY", "ja-JP")).toBeNull();
    expect(parseMoneyInput("1.250", "KWD", "en")).toBe(1250);
  });

  it("follows the locale's separators", () => {
    expect(parseMoneyInput("1.250,50", "EUR", "de-DE")).toBe(125_050);
    expect(parseMoneyInput("1,5", "EUR", "de-DE")).toBe(150);
  });

  it.each(["", "abc", "-5", "12.345", "1e3", "1,25,0.5.0", "₱100", "12..5"])("rejects %j", (input) => {
    expect(parseMoneyInput(input, "PHP", "en-PH")).toBeNull();
  });

  it("caps the size of an amount", () => {
    const max = "9".repeat(MAX_AMOUNT_WHOLE_DIGITS);
    expect(parseMoneyInput(max, "PHP", "en-PH")).toBe(Number(max) * 100);
    expect(parseMoneyInput(`1${max}`, "PHP", "en-PH")).toBeNull();
  });
});

describe("formatAmountForInput", () => {
  it("writes minor units back the way the parser reads them", () => {
    expect(formatAmountForInput(125_050, "PHP", "en-PH")).toBe("1,250.50");
    expect(formatAmountForInput(125_050, "EUR", "de-DE")).toBe("1.250,50");
    expect(formatAmountForInput(1250, "JPY", "ja-JP")).toBe("1,250");
    expect(formatAmountForInput(99_999_999_999_999, "PHP", "en-PH")).toBe("999,999,999,999.99");
  });

  it("round-trips through parseMoneyInput", () => {
    for (const minor of [0, 1, 99, 100, 123_456_789]) {
      expect(parseMoneyInput(formatAmountForInput(minor, "PHP", "en-PH"), "PHP", "en-PH")).toBe(minor);
    }
  });
});
