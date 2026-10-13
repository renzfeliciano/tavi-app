import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/modules/catalog";
import { itemFormValues } from "./catalog-copy";

const item: CatalogItem = {
  kind: "service",
  id: "01890000-0000-7000-8000-000000000000",
  name: "Aircon cleaning",
  description: null,
  sku: null,
  unitLabel: "hour",
  unitPriceMinor: 150_000,
  currency: "PHP",
  taxRateId: null,
  archivedAt: null,
};

describe("itemFormValues", () => {
  it("writes the price the way the business types it", () => {
    expect(itemFormValues(item, "en-PH")).toMatchObject({ name: "Aircon cleaning", unitPrice: "1,500.00", currency: "PHP" });
  });

  it("leaves the price field empty for an item that has no price yet", () => {
    expect(itemFormValues({ ...item, unitPriceMinor: null }, "en-PH").unitPrice).toBe("");
  });

  it("shows a free item as 0, not as empty", () => {
    expect(itemFormValues({ ...item, unitPriceMinor: 0 }, "en-PH").unitPrice).toBe("0.00");
  });
});
