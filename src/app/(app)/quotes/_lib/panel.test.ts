import { describe, expect, it } from "vitest";
import type { QuoteHeader } from "@/modules/quotes";
import { quotePanel } from "./panel";

const customerSnapshot = { displayName: "Juan Dela Cruz", company: "Dela Cruz Bakery", email: null, phone: "0917 555 0100", addressLines: [], taxId: null };

const quote = (over: Partial<QuoteHeader> = {}): QuoteHeader =>
  ({
    status: "SENT",
    customerId: "c1",
    customerSnapshot,
    issueDate: "2026-10-01",
    validUntil: "2026-10-30",
    sentAt: new Date("2026-10-01T01:00:00Z"),
    viewedAt: null,
    decidedAt: null,
    decisionName: null,
    decisionNote: null,
    cancelledAt: null,
    cancelReason: null,
    ...over,
  }) as QuoteHeader;

const options = { today: "2026-10-15", locale: "en-US", timezone: "Asia/Manila" };
const plain = (text: string | undefined) => text?.replace(/\s/g, " ");

describe("a quotation's side panel", () => {
  it("shows who it was issued to, with how to reach them", () => {
    expect(quotePanel(quote(), options).customer).toEqual({
      name: "Juan Dela Cruz",
      company: "Dela Cruz Bakery",
      email: null,
      phone: "0917 555 0100",
      href: "/customers/c1",
    });
  });

  it.each(["SENT", "VIEWED"] as const)("shows the date and how long it stays open while it is %s", (status) => {
    expect(quotePanel(quote({ status }), options).facts).toEqual([
      { key: "date", label: "Date", value: "Oct 1, 2026" },
      { key: "valid", label: "Valid until", value: "Oct 30, 2026", note: "15 days left" },
    ]);
  });

  it("never calls an open quotation's last days a danger: it is not money owed", () => {
    expect(quotePanel(quote({ validUntil: "2026-10-15" }), options).facts[1]).toEqual({
      key: "valid",
      label: "Valid until",
      value: "Oct 15, 2026",
      note: "last day",
    });
  });

  it.each(["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"] as const)("has no note once it is %s", (status) => {
    expect(quotePanel(quote({ status }), options).facts[1]).toEqual({ key: "valid", label: "Valid until", value: "Oct 30, 2026" });
  });

  it("lists sent, then opened, oldest first", () => {
    const events = quotePanel(quote({ status: "VIEWED", viewedAt: new Date("2026-10-02T06:15:00Z") }), options).events;
    expect(events.map((event) => event.label)).toEqual(["Sent", "Opened by the customer"]);
    expect(plain(events[1]?.on)).toBe("Oct 2, 2026, 2:15 PM");
  });

  it("names who approved it, or says the customer did when they gave no name", () => {
    const decidedAt = new Date("2026-10-03T02:00:00Z");
    expect(quotePanel(quote({ status: "APPROVED", decidedAt, decisionName: "Juan Dela Cruz" }), options).events.at(-1)?.label).toBe(
      "Approved by Juan Dela Cruz",
    );
    expect(quotePanel(quote({ status: "APPROVED", decidedAt }), options).events.at(-1)?.label).toBe("Approved by the customer");
  });

  it("carries the customer's note when they declined it", () => {
    const declined = quotePanel(
      quote({ status: "REJECTED", decidedAt: new Date("2026-10-03T02:00:00Z"), decisionNote: "Found a cheaper option" }),
      options,
    ).events.at(-1);
    expect(declined).toMatchObject({ label: "Declined", detail: "Found a cheaper option" });
  });

  it("shows a cancellation, and shows no decision a quotation that was not decided has", () => {
    const events = quotePanel(quote({ status: "CANCELLED", cancelledAt: new Date("2026-10-04T02:00:00Z") }), options).events;
    expect(events.map((event) => event.label)).toEqual(["Sent", "Cancelled"]);
  });

  it("gives the reason it was called off", () => {
    const cancelled = quotePanel(
      quote({ status: "CANCELLED", cancelledAt: new Date("2026-10-04T02:00:00Z"), cancelReason: "The customer chose another provider." }),
      options,
    ).events.at(-1);
    expect(cancelled).toMatchObject({ label: "Cancelled", detail: "The customer chose another provider." });
  });

  it("still shows that the customer approved it when the business called it off afterwards", () => {
    const events = quotePanel(
      quote({
        status: "CANCELLED",
        decidedAt: new Date("2026-10-03T02:00:00Z"),
        decisionName: "Juan Dela Cruz",
        cancelledAt: new Date("2026-10-04T02:00:00Z"),
      }),
      options,
    ).events;
    expect(events.map((event) => event.label)).toEqual(["Sent", "Approved by Juan Dela Cruz", "Cancelled"]);
  });

  it("has nothing related: the way on to the billing statement is on the page's own buttons", () => {
    expect(quotePanel(quote(), options).related).toEqual([]);
  });
});
