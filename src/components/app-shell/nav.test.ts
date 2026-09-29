import { describe, expect, it } from "vitest";
import { isActive, mobileMore, mobileTabs, primaryNav, settingsNav } from "./nav";

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
  it("reaches every desktop destination through tabs or More", () => {
    const mobile = new Set([...mobileTabs, ...mobileMore].map((i) => i.href));
    for (const item of [...primaryNav, settingsNav]) {
      expect(mobile.has(item.href)).toBe(true);
    }
  });
});
