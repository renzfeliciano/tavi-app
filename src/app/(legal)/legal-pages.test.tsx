import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

// The Terms say what the app actually enforces. Sending a quote or bill, and
// inviting a teammate, need a confirmed email; each business can only email so
// many documents an hour. A person who hits either should have been told.

const text = (node: React.ReactElement) => render(node).container.textContent ?? "";

describe("Terms of Service", () => {
  it("tells people to confirm their email before they send documents or invite teammates", () => {
    expect(text(<TermsPage />)).toMatch(/confirm your email address before you send .*invite a teammate/i);
  });

  it("says each business can only email so many documents an hour", () => {
    expect(text(<TermsPage />)).toMatch(/limit how many documents a business can email in an hour/i);
  });
});

describe("Privacy Notice", () => {
  it("reads the sign-in cookie's lifetimes from the session policy, not from typed-in numbers", () => {
    expect(text(<PrivacyPage />)).toContain("30 minutes without activity");
  });
});
