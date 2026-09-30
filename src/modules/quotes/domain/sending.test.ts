import { describe, expect, it } from "vitest";
import { QUOTE_LINK_GRACE_DAYS, quoteLinkExpiresAt, readinessToSend } from "./sending";

describe("readinessToSend", () => {
  const ready = { customerId: "c1", lineCount: 1, validUntil: "2026-10-15" };

  it("is ready with a customer, an item and a valid-until date from today on", () => {
    expect(readinessToSend(ready, "2026-10-15")).toEqual({});
  });

  it("explains everything missing at once", () => {
    expect(readinessToSend({ customerId: null, lineCount: 0, validUntil: "2026-09-30" }, "2026-10-01")).toEqual({
      customerId: "Choose a customer before sending.",
      lines: "Add at least one item before sending.",
      validUntil: "This quote's valid-until date has passed. Choose a date from today on.",
    });
  });
});

describe("quoteLinkExpiresAt", () => {
  it(`keeps the customer's link open ${QUOTE_LINK_GRACE_DAYS} days after the quote's valid-until date`, () => {
    expect(quoteLinkExpiresAt("2026-10-15").toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });
});
