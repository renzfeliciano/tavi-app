import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS, type FunnelRow, formatFunnel, summarizeFunnel } from "./funnel";

const at = (iso: string) => new Date(iso);
const row = (overrides: Partial<FunnelRow>): FunnelRow => ({
  organizationId: crypto.randomUUID(),
  businessName: "Santos Aircon",
  organizationCreatedAt: at("2026-10-01T00:00:00Z"),
  firstCustomerAt: null,
  firstQuoteAt: null,
  firstQuoteSentAt: null,
  firstApprovalAt: null,
  firstInvoiceAt: null,
  firstInvoiceSentAt: null,
  firstPaymentAt: null,
  lastActiveAt: null,
  ...overrides,
});

describe("summarizeFunnel", () => {
  it("counts how many businesses reached each step of the critical path", () => {
    const rows = [
      row({ firstCustomerAt: at("2026-10-01T00:05:00Z"), firstQuoteAt: at("2026-10-01T00:06:00Z"), firstQuoteSentAt: at("2026-10-01T00:10:00Z") }),
      row({ firstCustomerAt: at("2026-10-01T00:02:00Z") }),
      row({}),
    ];
    const summary = summarizeFunnel(rows);
    expect(summary.steps.map((s) => [s.key, s.reached])).toEqual([
      ["organizationCreatedAt", 3],
      ["firstCustomerAt", 2],
      ["firstQuoteAt", 1],
      ["firstQuoteSentAt", 1],
      ["firstApprovalAt", 0],
      ["firstInvoiceAt", 0],
      ["firstInvoiceSentAt", 0],
      ["firstPaymentAt", 0],
    ]);
    expect(FUNNEL_STEPS).toHaveLength(8);
  });

  it("reports the north star: median time from business created to first sent quote", () => {
    const rows = [
      row({ firstQuoteSentAt: at("2026-10-01T00:10:00Z") }), // 10 min
      row({ firstQuoteSentAt: at("2026-10-01T00:30:00Z") }), // 30 min
      row({ firstQuoteSentAt: at("2026-10-01T02:00:00Z") }), // 120 min
      row({}),
    ];
    expect(summarizeFunnel(rows).medianMinutesToFirstSentQuote).toBe(30);
    expect(summarizeFunnel([row({})]).medianMinutesToFirstSentQuote).toBeNull();
    expect(
      summarizeFunnel([row({ firstQuoteSentAt: at("2026-10-01T00:10:00Z") }), row({ firstQuoteSentAt: at("2026-10-01T00:20:00Z") })])
        .medianMinutesToFirstSentQuote,
    ).toBe(15);
  });

  it("names each business's furthest step, so stalls are easy to spot", () => {
    const summary = summarizeFunnel([row({ businessName: "A", firstCustomerAt: at("2026-10-01T01:00:00Z") }), row({ businessName: "B" })]);
    expect(summary.businesses).toEqual([
      expect.objectContaining({ name: "A", furthestStep: "First customer" }),
      expect.objectContaining({ name: "B", furthestStep: "Business created" }),
    ]);
  });
});

describe("formatFunnel", () => {
  it("prints steps with counts and the share of businesses that got there", () => {
    const text = formatFunnel(summarizeFunnel([row({ firstCustomerAt: at("2026-10-01T00:05:00Z") }), row({})]));
    expect(text).toContain("Business created      2  100%");
    expect(text).toContain("First customer        1   50%");
    expect(text).toContain("Median time to first sent quote: no sent quotes yet");
  });
});
