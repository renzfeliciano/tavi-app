import { describe, expect, it } from "vitest";
import { type AttentionInput, attentionItems } from "./attention-items";

const NOW = new Date("2026-10-12T04:00:00Z");
const base: AttentionInput = {
  overdue: [],
  quotes: { approvedNotInvoiced: [], awaitingReply: [], staleDrafts: [] },
  today: "2026-10-12",
  now: NOW,
  locale: "en-PH",
  quoteName: "Quotation",
};
const quote = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  number: `QUO-00000${id}`,
  status: "SENT" as const,
  currency: "PHP",
  totalMinor: 120000,
  customerName: "Juan Dela Cruz",
  since: new Date("2026-10-09T04:00:00Z"),
  ...overrides,
});

describe("attentionItems", () => {
  it("puts money already late first, then money ready to bill, then nudges", () => {
    const items = attentionItems({
      ...base,
      overdue: [{ id: "i1", number: "INV-000001", currency: "PHP", balanceMinor: 50000, dueDate: "2026-10-01", customerName: "Maria" }],
      quotes: {
        approvedNotInvoiced: [quote("1", { status: "APPROVED" })],
        awaitingReply: [quote("2")],
        staleDrafts: [quote("3", { status: "DRAFT", number: null })],
      },
    });

    expect(items.map((i) => i.kind)).toEqual(["overdue", "approved", "waiting", "draft"]);
  });

  it("tells an overdue bill's customer, due date and how late, with the balance", () => {
    const [item] = attentionItems({
      ...base,
      overdue: [{ id: "i1", number: "INV-000001", currency: "PHP", balanceMinor: 50000, dueDate: "2026-10-01", customerName: "Maria" }],
    });

    expect(item).toMatchObject({
      key: "overdue-i1",
      href: "/invoices/i1",
      number: "INV-000001",
      detail: "Maria · due Oct 1, 2026",
      late: "11 days late",
      amount: { minor: 50000, currency: "PHP" },
    });
  });

  it("links a quote to its page and says when it was approved or sent", () => {
    const items = attentionItems({
      ...base,
      quotes: { approvedNotInvoiced: [quote("1", { status: "APPROVED" })], awaitingReply: [quote("2")], staleDrafts: [] },
    });

    expect(items[0]).toMatchObject({ href: "/quotes/1", detail: "Juan Dela Cruz · approved 3 days ago", amount: { minor: 120000, currency: "PHP" } });
    expect(items[1]).toMatchObject({ href: "/quotes/2", detail: "Juan Dela Cruz · sent 3 days ago" });
  });

  it("names an unfinished draft by its customer, or by the document when it has none, with no amount", () => {
    const items = attentionItems({
      ...base,
      quotes: {
        approvedNotInvoiced: [],
        awaitingReply: [],
        staleDrafts: [quote("3", { status: "DRAFT", number: null }), quote("4", { status: "DRAFT", number: null, customerName: null })],
      },
    });

    expect(items[0]).toMatchObject({ number: null, title: "Juan Dela Cruz", detail: "last edited 3 days ago" });
    expect(items[0]?.amount).toBeUndefined();
    expect(items[1]).toMatchObject({ title: "Draft quotation" });
  });

  it("does not name a missing customer as an empty string", () => {
    const [item] = attentionItems({
      ...base,
      overdue: [{ id: "i1", number: "INV-000001", currency: "PHP", balanceMinor: 50000, dueDate: "2026-10-10", customerName: null }],
    });

    expect(item?.detail).toBe("due Oct 10, 2026");
    expect(item?.late).toBe("2 days late");
  });

  it("has nothing when nothing needs attention", () => {
    expect(attentionItems(base)).toEqual([]);
  });
});
