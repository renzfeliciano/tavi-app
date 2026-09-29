import { describe, expect, it } from "vitest";
import {
  currencyExponent,
  formatMoney,
  isCurrencyCode,
  minorToDecimalString,
} from "./format";

describe("currencyExponent", () => {
  it.each([
    ["PHP", 2],
    ["USD", 2],
    ["JPY", 0],
    ["KWD", 3],
  ])("knows %s has %i minor-unit digits", (currency, exponent) => {
    expect(currencyExponent(currency)).toBe(exponent);
  });

  it("rejects an unknown currency", () => {
    expect(() => currencyExponent("XYZ")).toThrow(/Unsupported currency/);
  });
});

describe("isCurrencyCode", () => {
  it("accepts real ISO 4217 codes", () => {
    expect(isCurrencyCode("PHP")).toBe(true);
    expect(isCurrencyCode("EUR")).toBe(true);
  });

  it("rejects malformed, lowercase and made-up codes", () => {
    expect(isCurrencyCode("PESO")).toBe(false);
    expect(isCurrencyCode("php")).toBe(false);
    expect(isCurrencyCode("XYZ")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats pesos from centavos with the ₱ sign", () => {
    expect(formatMoney(840_000, "PHP")).toBe("₱8,400.00");
    expect(formatMoney(12_345, "PHP")).toBe("₱123.45");
    expect(formatMoney(5, "PHP")).toBe("₱0.05");
  });

  it("formats zero and negatives", () => {
    expect(formatMoney(0, "PHP")).toBe("₱0.00");
    expect(formatMoney(-50_000, "PHP")).toBe("-₱500.00");
  });

  it("respects each currency's minor-unit exponent", () => {
    expect(formatMoney(1_500, "JPY")).toBe("¥1,500");
    // Intl joins a code prefix to the number with a non-breaking space.
    expect(formatMoney(1_234, "KWD")).toBe("KWD 1.234");
    expect(formatMoney(1_250, "EUR")).toBe("€12.50");
  });

  it("accepts a locale override", () => {
    expect(formatMoney(1_000, "USD", { locale: "en-US" })).toBe("$10.00");
  });

  it("formats the largest safe amount exactly, with no float rounding", () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER, "PHP")).toBe(
      "₱90,071,992,547,409.91",
    );
  });

  it("refuses fractional minor units", () => {
    expect(() => formatMoney(10.5, "PHP")).toThrow(/integer/);
  });

  it("refuses amounts beyond the safe-integer range", () => {
    expect(() => formatMoney(2 ** 53, "PHP")).toThrow(/integer/);
  });

  it("refuses an unknown currency", () => {
    expect(() => formatMoney(100, "XYZ")).toThrow(/Unsupported currency/);
  });
});

describe("minorToDecimalString", () => {
  it("returns the exact decimal amount without floats", () => {
    expect(minorToDecimalString(12_345, "PHP")).toBe("123.45");
    expect(minorToDecimalString(-5, "PHP")).toBe("-0.05");
    expect(minorToDecimalString(1_500, "JPY")).toBe("1500");
  });

  it("refuses fractional minor units", () => {
    expect(() => minorToDecimalString(1.5, "PHP")).toThrow(/integer/);
  });
});
