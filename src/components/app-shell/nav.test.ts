import { describe, expect, it } from "vitest";
import {
  badgeFor,
  isActive,
  mobileTabs,
  navGroupsFor,
  newActionsFor,
  newMenuFor,
  withDocumentNames,
} from "./nav";

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

describe("market wording", () => {
  const ph = {
    quote: { singular: "Quotation", plural: "Quotations" },
    invoice: { singular: "Billing statement", plural: "Billing statements" },
    purchaseOrder: { singular: "Purchase order", plural: "Purchase orders" },
  };

  it("names the sidebar links like the pages they open", () => {
    const labels = withDocumentNames(navGroupsFor({ canReadReports: false, documents: ph }).flatMap((g) => g.items), ph).map((i) => i.label);
    expect(labels).toContain("Billing statements");
    expect(labels).toContain("Quotations");
    expect(labels).toContain("Purchase orders");
    expect(labels).toContain("Dashboard");
  });

  it("keeps phone tabs to one word", () => {
    expect(withDocumentNames(mobileTabs, ph, { short: true }).map((i) => i.label)).toEqual([
      "Home",
      "Quotations",
      "Statements",
    ]);
  });

  it("words the New menu for the market", () => {
    const labels = newActionsFor(ph).map((a) => a.label);
    expect(labels).toContain("New billing statement");
    expect(labels).toContain("New quotation");
    expect(labels).toContain("New purchase order");
  });

  it("offers a receipt for money that isn't an invoice payment, after Record payment", () => {
    const actions = newActionsFor(ph);
    const labels = actions.map((a) => a.label);
    expect(labels.indexOf("New receipt")).toBe(labels.indexOf("Record payment") + 1);
    expect(actions.find((a) => a.label === "New receipt")).toMatchObject({
      href: "/receipts/new",
      description: "Money received that isn't an invoice payment",
    });
  });
});

const PH_DOCS = {
  quote: { singular: "Quotation", plural: "Quotations" },
  invoice: { singular: "Billing statement", plural: "Billing statements" },
  purchaseOrder: { singular: "Purchase order", plural: "Purchase orders" },
};

describe("sidebar groups", () => {
  it("puts the dashboard alone, then Sales, then Manage", () => {
    const groups = navGroupsFor({ canReadReports: true, documents: PH_DOCS });
    expect(groups.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      [null, ["Dashboard"]],
      ["Sales", ["Quotations", "Billing statements", "Recurring", "Payments"]],
      ["Manage", ["Purchase orders", "Customers", "Products & Services", "Reports"]],
    ]);
  });

  it("leaves Reports out for people who can't read them (D18)", () => {
    const manage = navGroupsFor({ canReadReports: false, documents: PH_DOCS }).find((g) => g.id === "manage");
    expect(manage?.items.map((i) => i.label)).not.toContain("Reports");
  });

  it("leaves Settings to the account menu, so it isn't listed twice", () => {
    const hrefs = navGroupsFor({ canReadReports: true, documents: PH_DOCS }).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/settings");
  });

  it("has every phone tab as a sidebar link too", () => {
    const hrefs = new Set(navGroupsFor({ canReadReports: true, documents: PH_DOCS }).flatMap((g) => g.items.map((i) => i.href)));
    for (const item of mobileTabs) expect(hrefs.has(item.href)).toBe(true);
  });
});

describe("count badges", () => {
  const facts = { overdueCount: 3, draftCount: 1 };

  it("counts overdue billing statements as something to act on", () => {
    expect(badgeFor("/invoices", facts)).toEqual({ text: "3", label: "3 overdue", tone: "alert" });
  });

  it("counts draft quotations quietly", () => {
    expect(badgeFor("/quotes", facts)).toEqual({ text: "1", label: "1 draft", tone: "quiet" });
    expect(badgeFor("/quotes", { ...facts, draftCount: 4 })?.label).toBe("4 drafts");
  });

  it("shows nothing for zero, for other links, or when the facts couldn't be read", () => {
    expect(badgeFor("/invoices", { overdueCount: 0, draftCount: 0 })).toBeNull();
    expect(badgeFor("/quotes", { overdueCount: null, draftCount: null })).toBeNull();
    expect(badgeFor("/customers", facts)).toBeNull();
    expect(badgeFor("/invoices", null)).toBeNull();
  });

  it("caps a long count", () => {
    expect(badgeFor("/invoices", { overdueCount: 240, draftCount: 0 })?.text).toBe("99+");
  });
});

describe("the New menu", () => {
  it("offers the two documents, a customer, a product and a service, worded for the market", () => {
    expect(newMenuFor(PH_DOCS).map((a) => a.label)).toEqual([
      "New quotation",
      "New billing statement",
      "Add customer",
      "Product",
      "Service",
    ]);
  });

  it("adds a receipt after the billing statement for someone who can record payments", () => {
    expect(newMenuFor(PH_DOCS, { canRecordPayments: true }).map((a) => a.label)).toEqual([
      "New quotation",
      "New billing statement",
      "New receipt",
      "Add customer",
      "Product",
      "Service",
    ]);
    expect(newMenuFor(PH_DOCS, { canRecordPayments: true }).find((a) => a.label === "New receipt")?.href).toBe("/receipts/new");
  });

  it("adds a purchase order after the receipt for someone who can write them, named by the market", () => {
    const labels = newMenuFor(PH_DOCS, { canRecordPayments: true, canPurchase: true }).map((a) => a.label);
    expect(labels).toEqual([
      "New quotation",
      "New billing statement",
      "New receipt",
      "New purchase order",
      "Add customer",
      "Product",
      "Service",
    ]);
    expect(newMenuFor(PH_DOCS, { canPurchase: true }).find((a) => a.label === "New purchase order")?.href).toBe("/purchase-orders/new");
  });

  it("leaves the purchase order out for someone who can't write them", () => {
    expect(newMenuFor(PH_DOCS).map((a) => a.label)).not.toContain("New purchase order");
  });

  it("leaves the receipt out for someone who can't record payments, since the page would be a 404 for them", () => {
    expect(newMenuFor(PH_DOCS, { canRecordPayments: false }).map((a) => a.label)).not.toContain("New receipt");
  });

  it("names products before services, in the order of the page they belong to (Products & Services)", () => {
    const hrefs: string[] = newMenuFor(PH_DOCS).map((a) => a.href);

    expect(hrefs.indexOf("/catalog/products/new")).toBeLessThan(hrefs.indexOf("/catalog/services/new"));
  });
});
