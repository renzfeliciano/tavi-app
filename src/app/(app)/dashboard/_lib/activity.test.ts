import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { describeActivity } from "./activity";

const event = (action: string, metadata: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  action,
  actorType: "user",
  entityType: action.split(".")[0] ?? "",
  entityId: "e1",
  metadata,
  ...extra,
});

describe("describeActivity", () => {
  const market = MARKETS.PH;

  it("says what happened to a quote, in the market's words", () => {
    expect(describeActivity(event("quote.sent", { number: "QUO-000012" }), market)).toEqual({
      text: "Quotation QUO-000012 sent",
      href: "/quotes/e1",
    });
    expect(
      describeActivity(event("quote.approved", { number: "QUO-000012", name: "Juan Dela Cruz" }, { actorType: "customer" }), market),
    ).toEqual({ text: "Juan Dela Cruz approved Quotation QUO-000012", href: "/quotes/e1" });
    expect(describeActivity(event("quote.rejected", { number: "QUO-000012" }, { actorType: "customer" }), market)?.text).toBe(
      "Customer declined Quotation QUO-000012",
    );
    expect(describeActivity(event("quote.viewed", { number: "QUO-000012" }), market)?.text).toBe(
      "Customer opened Quotation QUO-000012",
    );
  });

  it("describes invoices and payments", () => {
    expect(describeActivity(event("invoice.sent", { number: "INV-000003" }), market)?.text).toBe("Billing statement INV-000003 sent");
    expect(describeActivity(event("invoice.voided", { number: "INV-000003" }), market)?.text).toBe(
      "Billing statement INV-000003 voided",
    );
    expect(
      describeActivity(event("payment.recorded", { receiptNumber: "REC-000001", invoiceNumber: "INV-000003" }), market),
    ).toEqual({ text: "Payment REC-000001 recorded on Billing statement INV-000003", href: "/payments/e1" });
  });

  it("skips housekeeping that isn't news (sign-ins, settings, links)", () => {
    for (const action of ["auth.signed_in", "organization.updated", "quote.link_created", "tax_rate.created"]) {
      expect(describeActivity(event(action), market)).toBeNull();
    }
  });
});
