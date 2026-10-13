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
      kind: "sent",
    });
    expect(
      describeActivity(event("quote.approved", { number: "QUO-000012", name: "Juan Dela Cruz" }, { actorType: "customer" }), market),
    ).toEqual({ text: "Juan Dela Cruz approved Quotation QUO-000012", href: "/quotes/e1", kind: "approved" });
    expect(describeActivity(event("quote.rejected", { number: "QUO-000012" }, { actorType: "customer" }), market)?.text).toBe(
      "Customer declined Quotation QUO-000012",
    );
    expect(describeActivity(event("quote.viewed", { number: "QUO-000012" }), market)?.text).toBe(
      "Customer opened Quotation QUO-000012",
    );
  });

  it("describes invoices and payments", () => {
    expect(describeActivity(event("invoice.sent", { number: "INV-000003" }), market)?.text).toBe("Billing statement INV-000003 sent");
    expect(describeActivity(event("invoice.sent", { number: "0007", title: "Service Invoice" }), market)?.text).toBe(
      "Service Invoice 0007 sent",
    );
    expect(describeActivity(event("invoice.voided", { number: "INV-000003" }), market)?.text).toBe(
      "Billing statement INV-000003 voided",
    );
    expect(
      describeActivity(event("payment.recorded", { receiptNumber: "REC-000001", invoiceNumber: "INV-000003" }), market),
    ).toEqual({ text: "Payment REC-000001 recorded on Billing statement INV-000003", href: "/payments/e1", kind: "paid" });
  });

  it("says what kind of thing happened, so the feed can draw the right mark beside it", () => {
    const kind = (action: string) => describeActivity(event(action, { number: "X-1" }), market)?.kind;
    expect(["quote.sent", "invoice.sent"].map(kind)).toEqual(["sent", "sent"]);
    expect(["quote.viewed", "invoice.viewed"].map(kind)).toEqual(["viewed", "viewed"]);
    expect(kind("quote.approved")).toBe("approved");
    expect(kind("quote.rejected")).toBe("declined");
    expect(kind("invoice.edited")).toBe("edited");
    expect(kind("payment.recorded")).toBe("paid");
    // Things that were closed off, undone or ran out.
    expect(["quote.expired", "quote.cancelled", "invoice.voided", "invoice.cancelled", "payment.voided"].map(kind)).toEqual(
      ["closed", "closed", "closed", "closed", "closed"],
    );
  });

  it("skips housekeeping that isn't news (sign-ins, settings, links)", () => {
    for (const action of ["auth.signed_in", "organization.updated", "quote.link_created", "tax_rate.created"]) {
      expect(describeActivity(event(action), market)).toBeNull();
    }
  });
});
