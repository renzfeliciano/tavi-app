import { describe, expect, it } from "vitest";
import { reminderMessage } from "./reminder-message";

const base = {
  customerName: "Mark Villanueva",
  businessName: "Santos Aircon Services",
  documentName: "Billing statement INV-000012",
  balanceMinor: 900_000,
  paidMinor: 0,
  currency: "PHP",
  locale: "en-PH",
  dueDate: "2026-10-25",
  today: "2026-10-10",
  url: "https://example.test/p/abc",
};

describe("reminderMessage", () => {
  it("greets by first name and states the amount and the link", () => {
    const text = reminderMessage(base);
    expect(text).toContain("Hi Mark,");
    expect(text).toContain("Billing statement INV-000012");
    expect(text).toContain("9,000.00");
    expect(text).toContain("https://example.test/p/abc");
    expect(text).toContain("Santos Aircon Services");
  });

  it("says when it is due, today, or how late it is", () => {
    expect(reminderMessage(base)).toContain("is due on");
    expect(reminderMessage({ ...base, today: "2026-10-25" })).toContain("is due today");
    expect(reminderMessage({ ...base, today: "2026-10-26" })).toContain("yesterday");
    expect(reminderMessage({ ...base, today: "2026-10-30" })).toContain("5 days ago");
  });

  it("names the remaining balance after a part payment", () => {
    expect(reminderMessage({ ...base, paidMinor: 100_000, today: "2026-10-30" })).toContain("the remaining");
  });

  it("falls back to a plain greeting without a name", () => {
    expect(reminderMessage({ ...base, customerName: null })).toMatch(/^Hello,/);
  });
});
