import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { letterhead } from "./letterhead";

const profile = {
  name: "Santos Aircon",
  legalName: "Santos Aircon Services OPC",
  taxId: "123-456-789-00000",
  taxRegistration: "vat",
  email: "billing@santos.example",
  phone: "0917 555 0100",
  addressLine1: "12 Mabini St.",
  addressLine2: null,
  city: "Quezon City",
  region: "Metro Manila",
  postalCode: "1100",
};

describe("letterhead", () => {
  it("heads documents the way RR 7-2024 Sec. 6(B.1–B.3) asks: names, registration statement + TIN, address", () => {
    expect(letterhead(profile, MARKETS.PH, null)).toEqual({
      name: "Santos Aircon",
      subtitle: "Santos Aircon Services OPC",
      addressLines: ["12 Mabini St.", "Quezon City, Metro Manila 1100"],
      contactLines: ["billing@santos.example", "0917 555 0100"],
      taxId: { label: "VAT Reg TIN", value: "123-456-789-00000" },
      logo: null,
    });
  });

  it("uses the plain tax-ID label until the registration status is set, and skips a repeated name", () => {
    const head = letterhead({ ...profile, taxRegistration: null, legalName: "Santos Aircon" }, MARKETS.PH, null);
    expect(head.taxId).toEqual({ label: "TIN", value: "123-456-789-00000" });
    expect(head.subtitle).toBeNull();
  });
});
