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
  it("keeps only the identity fields (and the payment QRs)", () => {
    expect(sellerFrom({ ...live, extra: "x" } as typeof live)).toEqual({ ...live, paymentQrs: [] });
  });

  it("keeps the enabled payment QRs, in order, and drops the disabled ones", () => {
    const paymentQrs = [
      { label: "GCash", value: "https://pay.example/a", enabled: true },
      { label: "Maya", value: "https://pay.example/b", enabled: false },
      { label: "BDO", value: "https://pay.example/c", enabled: true },
    ];
    expect(sellerFrom({ ...live, paymentQrs }).paymentQrs).toEqual([
      { label: "GCash", value: "https://pay.example/a", enabled: true },
      { label: "BDO", value: "https://pay.example/c", enabled: true },
    ]);
  });
});

describe("withSeller", () => {
  it("prints the snapshot's identity over the live profile", () => {
    const before = sellerFrom(live);
    const after = { ...live, name: "Santos Cooling", taxId: "999-999-999-000", city: "Makati" };
    expect(withSeller(after, before)).toEqual({ ...live, paymentQrs: [] });
  });

  it("prints the QRs the document was issued with, not the ones added since", () => {
    const qr = { label: "GCash", value: "https://pay.example/a", enabled: true };
    const before = sellerFrom({ ...live, paymentQrs: [qr] });
    const after = { ...live, paymentQrs: [qr, { ...qr, label: "Maya" }] };
    expect(withSeller(after, before).paymentQrs).toEqual([qr]);
  });

  it("prints no QRs for a snapshot taken before QRs existed", () => {
    const legacy = { ...live }; // no paymentQrs key
    const after = { ...live, paymentQrs: [{ label: "GCash", value: "https://pay.example/a", enabled: true }] };
    expect(withSeller(after, legacy).paymentQrs).toEqual([]);
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
