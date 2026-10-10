import { describe, expect, it } from "vitest";
import { isActive, mobileMoreFor, mobileTabs, newActionsFor, withDocumentNames, primaryNavFor, reportsNav, settingsNav } from "./nav";

describe("isActive", () => {
  it("matches the section page itself", () => {
    expect(isActive("/quotes", "/quotes")).toBe(true);
  });

  it("matches pages beneath the section", () => {
    expect(isActive("/quotes/new", "/quotes")).toBe(true);
  });

  it("does not match a section that merely shares a prefix", () => {
    expect(isActive("/quotes-archive", "/quotes")).toBe(false);
  });
});

describe("mobile navigation", () => {
  it.each([true, false])("reaches every desktop destination through tabs or More (reports: %s)", (canReadReports) => {
    const account = { canReadReports };
    const mobile = new Set([...mobileTabs, ...mobileMoreFor(account)].map((i) => i.href));
    for (const item of [...primaryNavFor(account), settingsNav]) {
      expect(mobile.has(item.href)).toBe(true);
    }
  });

  it("shows Reports only to people who can read reports (D18)", () => {
    expect(primaryNavFor({ canReadReports: true })).toContain(reportsNav);
    expect(primaryNavFor({ canReadReports: false })).not.toContain(reportsNav);
    expect(mobileMoreFor({ canReadReports: false })).not.toContain(reportsNav);
    expect(mobileMoreFor({ canReadReports: true }).at(-1)).toBe(settingsNav);
  });
});

describe("market wording", () => {
  const ph = {
    quote: { singular: "Quotation", plural: "Quotations" },
    invoice: { singular: "Billing statement", plural: "Billing statements" },
  };

  it("names the sidebar links like the pages they open", () => {
    const labels = withDocumentNames(primaryNavFor({ canReadReports: false }), ph).map((i) => i.label);
    expect(labels).toContain("Billing statements");
    expect(labels).toContain("Quotations");
    expect(labels).toContain("Dashboard");
  });

  it("keeps phone tabs to one word", () => {
    expect(withDocumentNames(mobileTabs, ph, { short: true }).map((i) => i.label)).toEqual([
      "Home",
      "Quotations",
      "Statements",
    ]);
  });

  it("words the New menu for the market", () => {
    const labels = newActionsFor(ph).map((a) => a.label);
    expect(labels).toContain("New billing statement");
    expect(labels).toContain("New quotation");
  });
});
