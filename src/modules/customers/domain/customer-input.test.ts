import { describe, expect, it } from "vitest";
import { CUSTOMER_FIELDS, customerInputSchema } from "./customer-input";
import { CUSTOMER_LIMITS } from "./limits";

const valid = {
  displayName: "Juan Dela Cruz",
  company: "Dela Cruz Bakery",
  email: "Juan@DelaCruz.example",
  phone: "+63 917 555 0100",
  addressLine1: "45 Rizal Ave.",
  addressLine2: "",
  city: "Pasig",
  region: "Metro Manila",
  postalCode: "1600",
  taxId: "987-654-321-00000",
  currency: "",
  category: "",
  notes: "Gate code 1234. Prefers Viber.",
};

describe("customerInputSchema", () => {
  it("accepts a customer, trimming text and turning blanks into null", () => {
    expect(customerInputSchema.parse({ ...valid, displayName: "  Juan Dela Cruz  " })).toEqual({
      displayName: "Juan Dela Cruz",
      company: "Dela Cruz Bakery",
      email: "juan@delacruz.example",
      phone: "+63 917 555 0100",
      addressLine1: "45 Rizal Ave.",
      addressLine2: null,
      city: "Pasig",
      region: "Metro Manila",
      postalCode: "1600",
      taxId: "987-654-321-00000",
      currency: null,
      category: null,
      notes: "Gate code 1234. Prefers Viber.",
    });
  });

  it("needs only a name", () => {
    const parsed = customerInputSchema.parse({ displayName: "Walk-in customer" });
    expect(parsed).toMatchObject({ displayName: "Walk-in customer", email: null, currency: null });
  });

  it("keeps a chosen currency for customers billed in another one", () => {
    expect(customerInputSchema.parse({ ...valid, currency: "USD" }).currency).toBe("USD");
  });

  it("explains invalid fields in plain language", () => {
    const result = customerInputSchema.safeParse({
      ...valid,
      displayName: " ",
      email: "juan at bakery",
      currency: "XYZ",
      notes: "x".repeat(CUSTOMER_LIMITS.notes + 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toEqual({
      displayName: ["Enter the customer's name."],
      email: ["Enter a valid email address."],
      currency: ["Choose a currency."],
      notes: ["Use 2,000 characters or fewer."],
    });
  });

  it("lists every field the form posts", () => {
    expect([...CUSTOMER_FIELDS].sort()).toEqual(Object.keys(valid).sort());
  });

  describe("category (D21)", () => {
    it("is optional: blank means untagged", () => {
      const parsed = customerInputSchema.parse({ displayName: "Juan", category: "" });
      expect(parsed.category).toBeNull();
    });

    it("accepts a known category", () => {
      expect(customerInputSchema.parse({ displayName: "Juan", category: "food_beverage" }).category).toBe("food_beverage");
    });

    it("refuses an unknown category", () => {
      expect(customerInputSchema.safeParse({ displayName: "Juan", category: "pirates" }).success).toBe(false);
    });
  });
});
