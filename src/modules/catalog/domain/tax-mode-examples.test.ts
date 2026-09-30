import { describe, expect, it } from "vitest";
import { taxModeExamples } from "./tax-mode-examples";

describe("taxModeExamples", () => {
  it("works a round price through the suggested tax, in the business's currency", () => {
    expect(taxModeExamples({ currency: "PHP", locale: "en-PH", tax: { name: "VAT", rateBps: 1200 } })).toEqual({
      inclusive: "₱1,120.00 means ₱1,000.00 + ₱120.00 VAT.",
      exclusive: "₱1,000.00 becomes ₱1,120.00 with 12% VAT.",
    });
  });

  it("follows other currencies, locales and rates", () => {
    expect(taxModeExamples({ currency: "JPY", locale: "ja-JP", tax: { name: "消費税", rateBps: 1000 } })).toEqual({
      inclusive: "￥1,100 means ￥1,000 + ￥100 消費税.",
      exclusive: "￥1,000 becomes ￥1,100 with 10% 消費税.",
    });
  });

  it("explains the modes in words when the market suggests no tax", () => {
    expect(taxModeExamples({ currency: "USD", locale: "en-US", tax: null })).toEqual({
      inclusive: "The prices you enter already include tax.",
      exclusive: "Tax is added to the prices you enter.",
    });
  });
});
