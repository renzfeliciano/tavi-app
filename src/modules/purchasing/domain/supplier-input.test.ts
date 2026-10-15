import { describe, expect, it } from "vitest";
import { SUPPLIER_LIMITS } from "./limits";
import { SUPPLIER_FIELDS, supplierInputSchema } from "./supplier-input";

const valid = {
  displayName: "Santos Hardware Supply",
  contactName: "Maria Santos",
  email: "Orders@Santos.example",
  phone: "+63 917 555 0111",
  addressLine1: "12 Mabini St.",
  addressLine2: "",
  city: "Quezon City",
  region: "Metro Manila",
  postalCode: "1100",
  taxId: "123-456-789-00000",
  notes: "Delivers on Tuesdays.",
};

describe("supplierInputSchema", () => {
  it("accepts a supplier, trimming text, lowercasing the email and turning blanks into null", () => {
    expect(supplierInputSchema.parse({ ...valid, displayName: "  Santos Hardware Supply " })).toEqual({
      ...valid,
      email: "orders@santos.example",
      addressLine2: null,
    });
  });

  it("needs only a name", () => {
    expect(supplierInputSchema.parse({ displayName: "Cash supplier" })).toMatchObject({
      displayName: "Cash supplier",
      email: null,
      contactName: null,
    });
  });

  it("explains invalid fields in plain language", () => {
    const result = supplierInputSchema.safeParse({
      ...valid,
      displayName: " ",
      email: "orders at santos",
      notes: "x".repeat(SUPPLIER_LIMITS.notes + 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toEqual({
      displayName: ["Enter the supplier's name."],
      email: ["Enter a valid email address."],
      notes: ["Use 2,000 characters or fewer."],
    });
  });

  it("lists every field the form posts", () => {
    expect([...SUPPLIER_FIELDS].sort()).toEqual(Object.keys(valid).sort());
  });
});
