import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { incomeTaxConflict, parseRegistration, registeringOffice, tinParts } from "./registration";

const config = MARKETS.PH.registration!;
const ctx = { taxRegistration: "vat" as string | null, today: "2026-10-12" };
const parse = (input: Record<string, string>, over: Partial<typeof ctx> = {}) =>
  parseRegistration(config, input, { ...ctx, ...over });

describe("registration details", () => {
  it("accepts a real sole proprietor's certificates", () => {
    const result = parse(
      {
        taxpayerType: "sole_proprietor",
        incomeTaxOption: "graduated",
        taxOfficeCode: "044",
        taxRegisteredOn: "2026-01-15",
        lineOfBusiness: "Auto repair shop",
        industryCode: "45209",
        nameRegistrationAuthority: "dti",
        nameRegistrationNumber: "7397983",
        nameRegistrationScope: "national",
        nameRegistrationValidFrom: "2025-08-24",
        nameRegistrationValidUntil: "2030-08-24",
      },
    );
    expect(result).toMatchObject({ ok: true, details: { taxOfficeCode: "044", nameRegistrationScope: "national" } });
  });

  it("stores blanks as null", () => {
    const result = parse({});
    expect(result.ok && Object.values(result.details).every((v) => v === null)).toBe(true);
  });

  it("checks the RDO and PSIC code formats", () => {
    const result = parse({ taxOfficeCode: "44", industryCode: "ABC" });
    expect(result).toMatchObject({ ok: false, errors: { taxOfficeCode: expect.stringContaining("044"), industryCode: expect.stringContaining("45209") } });
  });

  it("rejects values outside the lists", () => {
    expect(parse({ taxpayerType: "wizard" })).toMatchObject({ ok: false, errors: { taxpayerType: expect.any(String) } });
  });

  it("limits the 8% option to individuals, and drops it for anyone else", () => {
    expect(parse({ incomeTaxOption: "eight_percent" }, { taxRegistration: "non_vat_exempt" })).toMatchObject({
      ok: false,
      errors: { incomeTaxOption: "Choose your taxpayer type first." },
    });
    expect(parse({ taxpayerType: "corporation", incomeTaxOption: "graduated" })).toMatchObject({ ok: false });
  });

  it("keeps the 8% option away from VAT and percentage tax", () => {
    const input = { taxpayerType: "sole_proprietor", incomeTaxOption: "eight_percent" };
    expect(parse(input, { taxRegistration: "vat" })).toMatchObject({ ok: false, errors: { incomeTaxOption: expect.stringContaining("VAT") } });
    expect(parse(input, { taxRegistration: "non_vat" })).toMatchObject({ ok: false, errors: { incomeTaxOption: expect.stringContaining("percentage tax") } });
    expect(parse(input, { taxRegistration: "non_vat_exempt" })).toMatchObject({ ok: true });
    expect(parse(input, { taxRegistration: null })).toMatchObject({ ok: true });
  });

  it("needs a number once an authority is chosen, and an authority for the rest", () => {
    expect(parse({ nameRegistrationAuthority: "dti" })).toMatchObject({ ok: false, errors: { nameRegistrationNumber: expect.stringContaining("Business Name No.") } });
    expect(parse({ nameRegistrationNumber: "123" })).toMatchObject({ ok: false, errors: { nameRegistrationAuthority: expect.any(String) } });
  });

  it("applies scope and validity only where the authority has them", () => {
    expect(parse({ nameRegistrationAuthority: "sec", nameRegistrationNumber: "CS2020", nameRegistrationScope: "national" })).toMatchObject({
      ok: false,
      errors: { nameRegistrationScope: expect.any(String) },
    });
    expect(parse({ nameRegistrationAuthority: "sec", nameRegistrationNumber: "CS2020", nameRegistrationValidUntil: "2030-01-01" })).toMatchObject({ ok: false });
  });

  it("rejects an end date before the start, a future registration day and fake dates", () => {
    expect(parse({ nameRegistrationAuthority: "dti", nameRegistrationNumber: "1", nameRegistrationValidFrom: "2026-02-01", nameRegistrationValidUntil: "2026-01-01" })).toMatchObject({ ok: false });
    expect(parse({ taxRegisteredOn: "2027-01-01" })).toMatchObject({ ok: false, errors: { taxRegisteredOn: expect.any(String) } });
    expect(parse({ taxRegisteredOn: "2026-02-30" })).toMatchObject({ ok: false });
  });

  it("explains the clash between the 8% option and a registration", () => {
    expect(incomeTaxConflict(config, "eight_percent", "vat")).toMatch(/VAT/);
    expect(incomeTaxConflict(config, "eight_percent", "non_vat")).toMatch(/percentage tax/);
    expect(incomeTaxConflict(config, "eight_percent", "non_vat_exempt")).toBeNull();
    expect(incomeTaxConflict(config, "graduated", "vat")).toBeNull();
  });
});

describe("a TIN's branch code", () => {
  it("splits the base and the branch", () => {
    expect(tinParts("618-327-286-00000")).toEqual({ base: "618327286", branch: "00000" });
    expect(tinParts("618327286001")).toEqual({ base: "618327286", branch: "001" });
    expect(tinParts("618-327-286")).toEqual({ base: "618327286", branch: null });
    expect(tinParts(null)).toBeNull();
  });

  it("tells the head office from a branch", () => {
    expect(registeringOffice("618-327-286-00000", config)).toEqual({ kind: "head_office" });
    expect(registeringOffice("618-327-286-000", config)).toEqual({ kind: "head_office" });
    expect(registeringOffice("618-327-286-00001", config)).toEqual({ kind: "branch", code: "00001" });
    expect(registeringOffice("618-327-286", config)).toEqual({ kind: "unknown" });
  });
});
