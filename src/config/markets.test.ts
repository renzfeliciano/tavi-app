import { describe, expect, it } from "vitest";
import { isCurrencyCode } from "@/shared/money";
import {
  DEFAULT_MARKET,
  documentWording,
  formatAddressLines,
  isMarketCode,
  MARKET_CODES,
  MARKETS,
  marketFor,
} from "./markets";

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

    it("lists the tax registrations a business can have, each with its document statement", () => {
      expect(market.taxRegistrations.length).toBeGreaterThan(0);
      const codes = market.taxRegistrations.map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
      for (const registration of market.taxRegistrations) {
        expect(registration.label.trim()).not.toBe("");
        expect(registration.statement.trim()).not.toBe("");
      }
    });

    it("names default units for products and services", () => {
      expect(market.units.product.trim()).not.toBe("");
      expect(market.units.service.trim()).not.toBe("");
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

describe("formatAddressLines", () => {
  it("writes an address the way the market does", () => {
    expect(
      formatAddressLines(
        { addressLine1: "45 Rizal Ave.", addressLine2: "Unit 3", city: "Pasig", region: "Metro Manila", postalCode: "1600" },
        MARKETS.PH,
      ),
    ).toEqual(["45 Rizal Ave.", "Unit 3", "Pasig, Metro Manila 1600"]);
  });

  it("leaves out missing parts without stray punctuation", () => {
    expect(formatAddressLines({ city: "Pasig", postalCode: "1600" }, MARKETS.PH)).toEqual(["Pasig 1600"]);
    expect(formatAddressLines({ region: "Metro Manila" }, MARKETS.PH)).toEqual(["Metro Manila"]);
    expect(formatAddressLines({ city: "Pasig", region: "Metro Manila" }, MARKETS.PH)).toEqual(["Pasig, Metro Manila"]);
    expect(formatAddressLines({}, MARKETS.PH)).toEqual([]);
  });
});

describe("the Philippine market (D13, RR 7-2024)", () => {
  it("states VAT or Non-VAT registration before the TIN, as Sec. 6(B.2) requires", () => {
    expect(MARKETS.PH.taxRegistrations.map((r) => [r.code, r.statement])).toEqual([
      ["vat", "VAT Reg TIN"],
      ["non_vat", "Non-VAT Reg TIN"],
      ["non_vat_exempt", "Non-VAT Reg TIN"],
    ]);
  });

  it("marks supplementary documents as not valid for claiming input tax (Sec. 6 B.15)", () => {
    expect(MARKETS.PH.supplementaryDocumentNotice).toBe("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  });

  it("only suggests VAT to VAT-registered businesses", () => {
    expect(MARKETS.PH.taxRegistrations.filter((r) => r.suggestsTaxes).map((r) => r.code)).toEqual(["vat"]);
  });
});
