import { describe, expect, it } from "vitest";
import { LEGAL } from "@/config/legal";
import { acceptedTermsVersion, needsTermsAcceptance } from "./terms";

describe("acceptedTermsVersion", () => {
  it("accepts the current version", () => {
    expect(acceptedTermsVersion(LEGAL.version)).toBe(LEGAL.version);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["an older version", "2020-01-01"],
    ["a boolean", true],
    ["a number", 20261002],
    ["padded", ` ${LEGAL.version}`],
  ])("refuses a value that's %s", (_label, value) => {
    expect(acceptedTermsVersion(value)).toBeNull();
  });

  it("compares against the version it's given", () => {
    expect(acceptedTermsVersion("2027-01-01", "2027-01-01")).toBe("2027-01-01");
    expect(acceptedTermsVersion(LEGAL.version, "2027-01-01")).toBeNull();
  });
});

describe("needsTermsAcceptance", () => {
  it("lets through someone who agreed to the current version", () => {
    expect(needsTermsAcceptance(LEGAL.version)).toBe(false);
  });

  it.each([
    ["an older version", "2020-01-01"],
    ["nothing (an account from before sign-up asked)", null],
    ["nothing at all", undefined],
  ])("asks again after %s", (_label, agreed) => {
    expect(needsTermsAcceptance(agreed)).toBe(true);
  });
});
