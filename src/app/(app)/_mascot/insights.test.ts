import { describe, expect, it } from "vitest";
import { type InsightFacts, insightsFrom, selectInsight } from "./insights";

const words = {
  quote: { one: "quotation", other: "quotations" },
  invoice: { one: "billing statement", other: "billing statements" },
};

const settled: InsightFacts = {
  words,
  can: { quotes: true, invoices: true, payments: true, manageBusiness: true },
  hasCustomer: true,
  hasQuote: true,
  hasSentQuote: true,
  approvedNotInvoiced: 0,
  awaitingReply: 0,
  staleDrafts: 0,
  overdueInvoices: 0,
  receivedToday: false,
  profileComplete: true,
};
const facts = (over: Partial<InsightFacts>): InsightFacts => ({ ...settled, ...over });
const ids = (f: InsightFacts) => insightsFrom(f).map((i) => i.id);

describe("insightsFrom: only what the data says", () => {
  it("says everything is up to date only when it is", () => {
    expect(insightsFrom(settled)).toEqual([
      expect.objectContaining({ id: "all-clear", kind: "positive", message: "Everything is up to date." }),
    ]);
    expect(ids(facts({ overdueInvoices: 1 }))).not.toContain("all-clear");
  });

  it("counts overdue invoices in the market's words, with a link", () => {
    const [one] = insightsFrom(facts({ overdueInvoices: 1 }));
    expect(one).toMatchObject({ kind: "action", message: "1 billing statement is overdue.", action: { href: "/invoices" } });
    const [many] = insightsFrom(facts({ overdueInvoices: 3 }));
    expect(many?.message).toBe("3 billing statements are overdue.");
  });

  it("points at approved quotes that are ready to bill", () => {
    const [i] = insightsFrom(facts({ approvedNotInvoiced: 2 }));
    expect(i).toMatchObject({ kind: "action", message: "2 quotations are approved and ready to bill.", action: { href: "/quotes" } });
  });

  it("nudges unanswered quotes and stale drafts as recommendations", () => {
    expect(insightsFrom(facts({ awaitingReply: 1 }))[0]).toMatchObject({ kind: "recommended" });
    expect(insightsFrom(facts({ staleDrafts: 2 }))[0]).toMatchObject({ kind: "recommended" });
  });

  it("walks a new business through the first quote, one step at a time", () => {
    const fresh = facts({ hasCustomer: false, hasQuote: false, hasSentQuote: false });
    expect(insightsFrom(fresh)[0]).toMatchObject({ id: "onboarding-customer", action: { href: "/customers/new" } });
    expect(insightsFrom({ ...fresh, hasCustomer: true })[0]).toMatchObject({ id: "onboarding-quote", action: { href: "/quotes/new" } });
    expect(insightsFrom({ ...fresh, hasCustomer: true, hasQuote: true })[0]).toMatchObject({ id: "onboarding-send", action: { href: "/quotes" } });
  });

  it("asks for business details only after the first customer, and only of someone who can edit them", () => {
    expect(ids(facts({ profileComplete: false }))).toContain("business-profile");
    expect(ids(facts({ profileComplete: false, hasCustomer: false }))).not.toContain("business-profile");
    expect(ids(facts({ profileComplete: false, can: { ...settled.can, manageBusiness: false } }))).not.toContain("business-profile");
  });

  it("stays silent about what the person cannot see", () => {
    const noInvoices = facts({ overdueInvoices: 4, can: { ...settled.can, invoices: false } });
    expect(ids(noInvoices)).not.toContain("overdue");
    const noQuotes = facts({ approvedNotInvoiced: 4, awaitingReply: 4, staleDrafts: 4, can: { ...settled.can, quotes: false } });
    expect(ids(noQuotes)).toEqual(["all-clear"]);
  });

  it("celebrates a payment received today", () => {
    expect(ids(facts({ receivedToday: true }))).toContain("received-today");
    expect(ids(facts({ receivedToday: true, can: { ...settled.can, payments: false } }))).not.toContain("received-today");
  });
});

describe("selectInsight: one thing at a time, on the right page", () => {
  const all = insightsFrom(facts({ overdueInvoices: 2, approvedNotInvoiced: 1, staleDrafts: 1, receivedToday: true }));

  it("surfaces the highest-value item on the dashboard", () => {
    expect(selectInsight(all, "/dashboard", new Set())?.id).toBe("overdue");
  });

  it("prefers what belongs to the page being viewed", () => {
    expect(selectInsight(all, "/quotes", new Set())?.id).toBe("approved");
    expect(selectInsight(all, "/payments", new Set())?.id).toBe("overdue");
  });

  it("says nothing on pages where nothing is relevant", () => {
    expect(selectInsight(all, "/settings/team", new Set())).toBeNull();
    expect(selectInsight(all, "/customers/abc", new Set())).toBeNull();
  });

  it("matches a section and its children, not lookalike prefixes", () => {
    expect(selectInsight(all, "/quotes/new", new Set())?.id).toBe("approved");
    expect(selectInsight(all, "/quotesy", new Set())).toBeNull();
  });

  it("skips what was dismissed and moves to the next", () => {
    expect(selectInsight(all, "/dashboard", new Set(["overdue"]))?.id).toBe("approved");
    expect(selectInsight(all, "/dashboard", new Set(all.map((i) => i.id)))).toBeNull();
  });

  it("lets a critical item through on any page", () => {
    const critical = [{ id: "x", kind: "critical" as const, message: "Blocked.", scopes: ["/dashboard"], priority: 1 }];
    expect(selectInsight(critical, "/settings/team", new Set())?.id).toBe("x");
  });
});
