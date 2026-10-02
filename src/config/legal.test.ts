import { describe, expect, it } from "vitest";
import { LEGAL, LEGAL_PLACEHOLDER, legalDetail, missingLegalDetails } from "./legal";

describe("legal configuration", () => {
  it("versions the documents by a real calendar date", () => {
    expect(LEGAL.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${LEGAL.version}T00:00:00Z`).toISOString().slice(0, 10)).toBe(LEGAL.version);
  });

  it("lists every operator detail that's still missing, in plain words", () => {
    expect(
      missingLegalDetails({ name: null, address: "  ", privacyEmail: null, dataProtectionOfficer: null }),
    ).toEqual(["operator name", "registered address", "privacy contact email", "data protection officer"]);
  });

  it("has nothing missing once every detail is filled in", () => {
    expect(
      missingLegalDetails({
        name: "Juan Dela Cruz",
        address: "1 Ayala Ave, Makati City",
        privacyEmail: "privacy@example.com",
        dataProtectionOfficer: "Juan Dela Cruz",
      }),
    ).toEqual([]);
  });

  it("shows the placeholder for a missing detail and the value otherwise", () => {
    expect(legalDetail(null)).toBe(LEGAL_PLACEHOLDER);
    expect(legalDetail(" ")).toBe(LEGAL_PLACEHOLDER);
    expect(legalDetail("privacy@example.com")).toBe("privacy@example.com");
  });
});
