import { describe, expect, it } from "vitest";
import { sellerFrom, withSeller } from "./seller-snapshot";

const live = {
  name: "Santos Aircon Services",
  legalName: "Maria Santos",
  taxId: "123-456-789-000",
  taxRegistration: "non_vat",
  email: "billing@santos.example",
  phone: "0917 000 0000",
  addressLine1: "12 Rizal St",
  addressLine2: null,
  city: "Quezon City",
  region: "NCR",
  postalCode: "1100",
};

describe("sellerFrom", () => {
  it("keeps only the identity fields", () => {
    expect(sellerFrom({ ...live, extra: "x" } as typeof live)).toEqual(live);
  });
});

describe("withSeller", () => {
  it("prints the snapshot's identity over the live profile", () => {
    const before = sellerFrom(live);
    const after = { ...live, name: "Santos Cooling", taxId: "999-999-999-000", city: "Makati" };
    expect(withSeller(after, before)).toEqual(live);
  });

  it("falls back to the live profile when the document has no snapshot", () => {
    expect(withSeller(live, null)).toBe(live);
    expect(withSeller(live, undefined)).toBe(live);
  });

  it("keeps the other fields of the live profile (logo, defaults, currency)", () => {
    const profile = { ...live, currency: "PHP", paymentInstructions: "Pay to GCash" };
    const result = withSeller({ ...profile, name: "New name" }, sellerFrom(live));
    expect(result).toMatchObject({ currency: "PHP", paymentInstructions: "Pay to GCash", name: live.name });
  });
});
