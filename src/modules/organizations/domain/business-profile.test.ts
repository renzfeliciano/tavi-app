import { describe, expect, it } from "vitest";
import { MARKETS, type MarketProfile } from "@/config/markets";
import { BUSINESS_PROFILE_FIELDS, businessProfileSchemaFor } from "./business-profile";

const businessProfileSchema = businessProfileSchemaFor(MARKETS.PH);

const valid = {
  name: "Acme Aircon Services",
  legalName: "Acme Aircon Services OPC",
  taxId: "123-456-789-00000",
  email: "billing@acmeaircon.ph",
  phone: "+63 917 123 4567",
  addressLine1: "12 Mabini St.",
  addressLine2: "",
  city: "Quezon City",
  region: "Metro Manila",
  postalCode: "1100",
  currency: "PHP",
  taxMode: "inclusive",
  quoteValidityDays: "30",
  paymentTermsDays: "15",
  defaultNotes: "Thank you for your business.",
  defaultTerms: "50% down payment before work starts.",
  paymentInstructions: "BDO Savings 0012-3456-7890 (Acme Aircon Services)\nGCash 0917 123 4567",
};

describe("businessProfileSchema", () => {
  it("accepts a complete profile and normalizes it", () => {
    const parsed = businessProfileSchema.parse(valid);
    expect(parsed).toMatchObject({
      name: "Acme Aircon Services",
      quoteValidityDays: 30,
      paymentTermsDays: 15,
      taxMode: "inclusive",
      addressLine2: null,
    });
  });

  it("turns blank optional fields into null", () => {
    const parsed = businessProfileSchema.parse({
      ...valid,
      legalName: "  ",
      taxId: "",
      email: "",
      phone: "",
      defaultNotes: "",
      paymentInstructions: "",
    });
    expect(parsed).toMatchObject({ legalName: null, taxId: null, email: null, phone: null, defaultNotes: null, paymentInstructions: null });
  });

  it("explains each invalid field in plain language", () => {
    const result = businessProfileSchema.safeParse({
      ...valid,
      name: " ",
      email: "billing at acme",
      taxId: "12-AB",
      quoteValidityDays: "0",
      paymentTermsDays: "400",
      currency: "XYZ",
      taxMode: "sometimes",
    });
    expect(result.success).toBe(false);
    const errors = result.success ? {} : result.error.flatten().fieldErrors;
    expect(errors).toMatchObject({
      name: ["Enter your business name."],
      email: ["Enter a valid email address."],
      taxId: ["Enter your TIN like 123-456-789-00000."],
      quoteValidityDays: ["Choose between 1 and 365 days."],
      paymentTermsDays: ["Choose between 0 and 365 days."],
      currency: ["Choose a currency."],
      taxMode: ["Choose how your prices handle tax."],
    });
  });

  it("limits long text so documents stay readable", () => {
    const result = businessProfileSchema.safeParse({ ...valid, defaultTerms: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("checks the tax ID against the business's own market", () => {
    const elsewhere: MarketProfile = {
      ...MARKETS.PH,
      country: "XX",
      taxId: { label: "VAT number", pattern: /^[A-Z]{2}\d{6}$/, example: "AB123456" },
    };
    const schema = businessProfileSchemaFor(elsewhere);

    expect(schema.safeParse({ ...valid, taxId: "AB123456" }).success).toBe(true);
    const result = schema.safeParse(valid);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your VAT number like AB123456.");
  });

  it("lists every field the form posts", () => {
    expect([...BUSINESS_PROFILE_FIELDS].sort()).toEqual(Object.keys(valid).sort());
  });
});
