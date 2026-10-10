import { describe, expect, it } from "vitest";
import { CATALOG_ITEM_LIMITS } from "@/modules/catalog/client";
import { MARKET_CODES, MARKETS } from "./markets";
import { CATEGORIES, CATEGORY_CODES, categoryFor, isCategoryCode, OTHER_CATEGORY } from "./categories";

describe("business and customer categories (D21)", () => {
  it("has a fallback that exists", () => {
    expect(CATEGORY_CODES).toContain(OTHER_CATEGORY);
  });

  it("recognises only its own codes", () => {
    expect(isCategoryCode("food_beverage")).toBe(true);
    expect(isCategoryCode("nonsense")).toBe(false);
    expect(isCategoryCode(null)).toBe(false);
  });

  it("falls back to the neutral category for an unknown or missing code", () => {
    expect(categoryFor(null).code).toBe(OTHER_CATEGORY);
    expect(categoryFor("nonsense").code).toBe(OTHER_CATEGORY);
    expect(categoryFor("retail").code).toBe("retail");
  });

  describe.each(CATEGORY_CODES)("%s", (code) => {
    const category = CATEGORIES[code];

    it("is keyed by its own code, in snake_case", () => {
      expect(category.code).toBe(code);
      expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/);
    });

    it("has words for the picker and an example item", () => {
      expect(category.label.trim()).not.toBe("");
      expect(category.hint.trim()).not.toBe("");
      expect(category.itemExample.trim()).not.toBe("");
    });

    it("suggests units and starter items that fit the catalog's limits", () => {
      expect(category.units.length).toBeGreaterThan(0);
      for (const unit of category.units) expect(unit.length).toBeLessThanOrEqual(CATALOG_ITEM_LIMITS.unitLabel);
      for (const item of category.starterItems) {
        expect(item.name.trim()).not.toBe("");
        expect(item.name.length).toBeLessThanOrEqual(CATALOG_ITEM_LIMITS.name);
        expect(item.unit.length).toBeLessThanOrEqual(CATALOG_ITEM_LIMITS.unitLabel);
      }
    });

    it("uses only units every market offers", () => {
      const units = [...category.units, ...category.starterItems.map((i) => i.unit)];
      for (const market of MARKET_CODES) {
        for (const unit of units) expect(MARKETS[market].units.options).toContain(unit);
      }
    });

    it("names no amounts: prices belong to the business, not to the category", () => {
      expect(JSON.stringify(category.starterItems)).not.toMatch(/[₱$€£]|\d{3,}/);
    });
  });
});
