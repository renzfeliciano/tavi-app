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

describe("Terms of Service: documents built since the last update", () => {
  it("names receipts, purchase orders and repeating bills, and says they are not official", () => {
    const terms = text(<TermsPage />);
    expect(terms).toMatch(/receipts/i);
    expect(terms).toMatch(/purchase orders/i);
    expect(terms).toMatch(/repeating bill/i);
    expect(terms).toMatch(/purchase orders and receipts .*not .*(tax invoices|official)/i);
  });

  it("says recorded withholding certificates are records, not filings", () => {
    expect(text(<TermsPage />)).toMatch(/withholding certificates .*(records|don.t file)/i);
  });

  it("explains the recycle bin and that the RDO and CPA worksheet is not advice", () => {
    const terms = text(<TermsPage />);
    expect(terms).toMatch(/recycle bin/i);
    expect(terms).toMatch(/RDO and CPA worksheet .*(not|no) .*advice/i);
  });
});

describe("Privacy Notice: records built since the last update", () => {
  it("lists repeating bills and withholding certificates among what is stored", () => {
    const privacy = text(<PrivacyPage />);
    expect(privacy).toMatch(/repeating bills/i);
    expect(privacy).toMatch(/withholding certificates/i);
    expect(privacy).toMatch(/payor/i);
  });

  it("says the worksheet is deleted when a business is closed", () => {
    expect(text(<PrivacyPage />)).toMatch(/worksheet .*deleted .*closed/i);
  });
});

describe("Privacy Notice", () => {
  it("reads the sign-in cookie's lifetimes from the session policy, not from typed-in numbers", () => {
    expect(text(<PrivacyPage />)).toContain("30 minutes without activity");
  });
});
