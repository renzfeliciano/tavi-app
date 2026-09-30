import { describe, expect, it } from "vitest";
import { CATALOG_ITEM_FIELDS, catalogItemSchemaFor } from "./catalog-item";

const units = { product: "pc", service: "hour" };
const product = catalogItemSchemaFor({ kind: "product", locale: "en-PH", units });
const service = catalogItemSchemaFor({ kind: "service", locale: "en-PH", units });

const valid = {
  name: " Aircon cleaning kit ",
  description: "Coil cleaner, brush and cover",
  sku: "ACK-01",
  unitLabel: "set",
  unitPrice: "1,250.50",
  currency: "PHP",
  taxRateId: "",
};

describe("catalogItemSchemaFor", () => {
  it("reads a product, turning the typed price into minor units", () => {
    expect(product.parse(valid)).toEqual({
      name: "Aircon cleaning kit",
      description: "Coil cleaner, brush and cover",
      sku: "ACK-01",
      unitLabel: "set",
      unitPriceMinor: 125_050,
      currency: "PHP",
      taxRateId: null,
    });
  });

  it("reads a service, which has no SKU", () => {
    const parsed = service.parse({ ...valid, name: "Aircon cleaning", unitLabel: "unit", sku: "IGNORED" });
    expect(parsed).toMatchObject({ name: "Aircon cleaning", unitPriceMinor: 125_050 });
    expect(parsed).not.toHaveProperty("sku");
  });

  it("reads the price in the item's own currency", () => {
    expect(product.parse({ ...valid, unitPrice: "1,250", currency: "JPY" }).unitPriceMinor).toBe(1250);
    expect(product.safeParse({ ...valid, unitPrice: "10.5", currency: "JPY" }).success).toBe(false);
  });

  it("keeps a chosen default tax rate", () => {
    const id = "01890000-0000-7000-8000-000000000000";
    expect(product.parse({ ...valid, taxRateId: id }).taxRateId).toBe(id);
  });

  it("explains invalid fields in plain language", () => {
    const result = product.safeParse({
      ...valid,
      name: "",
      unitLabel: " ",
      unitPrice: "12.345",
      currency: "XYZ",
      taxRateId: "not-an-id",
    });
    expect(result.error?.flatten().fieldErrors).toEqual({
      name: ["Enter a name."],
      unitLabel: ["Enter a unit, e.g. pc."],
      currency: ["Choose a currency."],
      taxRateId: ["Choose a tax rate from the list."],
    });
  });

  it("explains a price that can't be read, once the currency is known", () => {
    const result = product.safeParse({ ...valid, unitPrice: "12.345" });
    expect(result.error?.flatten().fieldErrors).toEqual({
      unitPrice: ["Enter a price like 1,250.50."],
    });
  });

  it("shows the example price in the business's locale and the item's currency", () => {
    const german = catalogItemSchemaFor({ kind: "service", locale: "de-DE", units });
    const result = german.safeParse({ ...valid, unitPrice: "abc", currency: "EUR" });
    expect(result.error?.flatten().fieldErrors).toEqual({ unitPrice: ["Enter a price like 1.250,50."] });
    expect(
      product.safeParse({ ...valid, unitPrice: "abc", currency: "JPY" }).error?.flatten().fieldErrors,
    ).toEqual({ unitPrice: ["Enter a price like 1,250."] });
  });

  it("lists the fields each form posts", () => {
    expect([...CATALOG_ITEM_FIELDS.product].sort()).toEqual(Object.keys(valid).sort());
    expect(CATALOG_ITEM_FIELDS.service).not.toContain("sku");
  });
});
