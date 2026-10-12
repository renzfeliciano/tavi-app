import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { filingsKnown, upcomingDeadlines, type DeadlineProfile } from "./tax-deadlines";

const config = MARKETS.PH.registration!;
const base: DeadlineProfile = {
  taxRegistration: "vat",
  taxpayerType: "sole_proprietor",
  incomeTaxOption: "graduated",
  taxRegisteredOn: null,
  nameRegistrationAuthority: null,
  nameRegistrationValidUntil: null,
};
const forms = (profile: Partial<DeadlineProfile>, today: string, limit = 20) =>
  upcomingDeadlines(config, { ...base, ...profile }, today, { limit }).map((d) => `${d.form ?? "renewal"} ${d.dueOn}`);

describe("upcoming tax deadlines", () => {
  it("lists a VAT-registered sole proprietor's returns in date order", () => {
    expect(forms({}, "2026-10-12", 5)).toEqual([
      "2550Q 2026-10-25",
      "1701Q 2026-11-15",
      "2550Q 2027-01-25",
      "1701 / 1701A 2027-04-15",
      "2550Q 2027-04-25",
    ]);
  });

  it("matches the filing dates on a real certificate of registration", () => {
    // COR: 1701Q on or before May 15, Aug 15 and Nov 15; annual by Apr 15; VAT on the 25th after each quarter.
    const all = forms({}, "2026-01-01");
    expect(all).toEqual(
      expect.arrayContaining([
        "2550Q 2026-01-25", "2550Q 2026-04-25", "2550Q 2026-07-25", "2550Q 2026-10-25",
        "1701Q 2026-05-15", "1701Q 2026-08-15", "1701Q 2026-11-15", "1701 / 1701A 2026-04-15",
      ]),
    );
  });

  it("keeps a deadline that falls today", () => {
    expect(forms({}, "2026-10-25", 1)).toEqual(["2550Q 2026-10-25"]);
  });

  it("gives a non-VAT business percentage tax returns instead of VAT returns", () => {
    const list = forms({ taxRegistration: "non_vat" }, "2026-10-12", 3);
    expect(list).toEqual(["2551Q 2026-10-25", "1701Q 2026-11-15", "2551Q 2027-01-25"]);
  });

  it("gives a business on the 8% option no percentage tax return", () => {
    const list = forms({ taxRegistration: "non_vat_exempt", incomeTaxOption: "eight_percent" }, "2026-10-12");
    expect(list.some((l) => l.startsWith("2551Q") || l.startsWith("2550Q"))).toBe(false);
    expect(list).toContain("1701Q 2026-11-15");
  });

  it("gives a corporation no individual income tax returns", () => {
    const list = forms({ taxpayerType: "corporation", incomeTaxOption: null }, "2026-10-12");
    expect(list.every((l) => l.startsWith("2550Q"))).toBe(true);
  });

  it("has nothing to list until the tax registration is set", () => {
    expect(forms({ taxRegistration: null }, "2026-10-12")).toEqual([]);
  });

  it("skips returns for periods that ended before the business registered", () => {
    // Registered 15 Jan 2026: the first VAT return (for Jan-Mar) is due 25 Apr 2026, and the 2025 annual return isn't due.
    const list = forms({ taxRegisteredOn: "2026-01-15" }, "2026-01-01");
    expect(list).not.toContain("2550Q 2026-01-25");
    expect(list).not.toContain("1701 / 1701A 2026-04-15");
    expect(list).toContain("2550Q 2026-04-25");
    expect(list).toContain("1701Q 2026-05-15");
  });

  it("adds the day a DTI registration lapses, and keeps it once it has", () => {
    const profile = { nameRegistrationAuthority: "dti", nameRegistrationValidUntil: "2026-11-01" };
    expect(forms(profile, "2026-10-12", 3)).toEqual(["2550Q 2026-10-25", "renewal 2026-11-01", "1701Q 2026-11-15"]);
    const lapsed = upcomingDeadlines(config, { ...base, ...profile }, "2026-12-01", { limit: 1 })[0];
    expect(lapsed).toMatchObject({ kind: "renewal", daysLeft: -30 });
  });

  it("ignores an end date for a registration that doesn't expire", () => {
    expect(forms({ nameRegistrationAuthority: "sec", nameRegistrationValidUntil: "2026-11-01" }, "2026-10-12")).not.toContain("renewal 2026-11-01");
  });

  it("counts whole days left", () => {
    expect(upcomingDeadlines(config, base, "2026-10-12", { limit: 1 })[0]?.daysLeft).toBe(13);
  });

  it("knows when it can't say which returns apply", () => {
    expect(filingsKnown(config, { taxRegistration: null, taxpayerType: null })).toBe(false);
    expect(filingsKnown(config, { taxRegistration: "vat", taxpayerType: null })).toBe(false);
    expect(filingsKnown(config, { taxRegistration: "vat", taxpayerType: "corporation" })).toBe(true);
  });
});
