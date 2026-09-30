import { describe, expect, it } from "vitest";
import { isCurrencyCode } from "@/shared/money";
import { DEFAULT_MARKET, documentWording, isMarketCode, MARKET_CODES, MARKETS, marketFor } from "./markets";

describe("market profiles", () => {
  it("includes the default market", () => {
    expect(MARKET_CODES).toContain(DEFAULT_MARKET);
  });

  describe.each(MARKET_CODES)("%s", (code) => {
    const market = MARKETS[code];

    it("is keyed by its own country code", () => {
      expect(market.country).toBe(code);
      expect(code).toMatch(/^[A-Z]{2}$/);
    });

    it("uses a real currency, locale and time zone", () => {
      expect(isCurrencyCode(market.currency)).toBe(true);
      expect(() => new Intl.NumberFormat(market.locale)).not.toThrow();
      expect(Intl.getCanonicalLocales(market.locale)).toEqual([market.locale]);
      expect(() => new Intl.DateTimeFormat("en", { timeZone: market.timezone })).not.toThrow();
    });

    it("has a tax-ID example that its own pattern accepts", () => {
      expect(market.taxId.pattern.test(market.taxId.example)).toBe(true);
    });

    it("suggests tax rates within 0–100%", () => {
      for (const rate of market.suggestedTaxRates) {
        expect(Number.isInteger(rate.rateBps)).toBe(true);
        expect(rate.rateBps).toBeGreaterThanOrEqual(0);
        expect(rate.rateBps).toBeLessThanOrEqual(10_000);
        expect(rate.name.trim()).not.toBe("");
      }
    });

    it("has document defaults the database accepts", () => {
      expect(market.quoteValidityDays).toBeGreaterThanOrEqual(1);
      expect(market.quoteValidityDays).toBeLessThanOrEqual(365);
      expect(market.paymentTermsDays).toBeGreaterThanOrEqual(0);
      expect(market.paymentTermsDays).toBeLessThanOrEqual(365);
    });
  });
});

describe("marketFor", () => {
  it("returns the stored country's profile, or the default for unknown codes", () => {
    expect(marketFor("PH")).toBe(MARKETS.PH);
    expect(marketFor("ZZ")).toBe(MARKETS[DEFAULT_MARKET]);
    expect(marketFor(null)).toBe(MARKETS[DEFAULT_MARKET]);
    expect(isMarketCode("ph")).toBe(false);
    expect(isMarketCode("toString")).toBe(false);
  });
});

describe("documentWording", () => {
  it("names the market's documents for running text", () => {
    expect(documentWording(MARKETS.PH)).toEqual({
      quotesAndInvoices: "quotations and billing statements",
      quoteAndInvoice: "quotation and billing statement",
      invoices: "billing statements",
    });
  });
});
