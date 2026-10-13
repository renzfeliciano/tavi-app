import { describe, expect, it } from "vitest";
import { catalogLinePrice } from "./catalog-line";

const service = { name: "Aircon cleaning", unitPriceMinor: 150_000 as number | null, currency: "PHP" };

describe("catalogLinePrice", () => {
  it("fills in the catalog price, typed the way the business types it", () => {
    expect(catalogLinePrice(service, "PHP", "en-PH")).toEqual({ unitPrice: "1,500.00", notice: null });
  });

  it("leaves the price for the owner when the item is priced in another currency than the document", () => {
    expect(catalogLinePrice(service, "USD", "en-PH")).toEqual({
      unitPrice: "",
      notice: "Aircon cleaning is priced in PHP. Enter its USD price.",
    });
  });

  it("leaves the price blank and says so when the item has no price yet", () => {
    expect(catalogLinePrice({ ...service, unitPriceMinor: null }, "PHP", "en-PH")).toEqual({
      unitPrice: "",
      notice: "Aircon cleaning has no price yet. Enter it on the line.",
    });
  });

  it("asks for the document's price once, not for a price in a currency it never had", () => {
    expect(catalogLinePrice({ ...service, unitPriceMinor: null }, "USD", "en-PH").notice).toBe(
      "Aircon cleaning has no price yet. Enter it on the line.",
    );
  });

  it("carries a free item through as 0, not as unpriced", () => {
    expect(catalogLinePrice({ ...service, unitPriceMinor: 0 }, "PHP", "en-PH")).toEqual({
      unitPrice: "0.00",
      notice: null,
    });
  });
});
