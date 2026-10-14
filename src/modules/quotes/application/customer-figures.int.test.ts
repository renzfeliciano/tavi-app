import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { lastQuoteChanges } from "./customer-figures";
import { listQuotes, saveQuoteDraft } from "./quotes";
import { quotes } from "../schema";
import { cancelQuote, reviseQuote, sendQuote } from "./sending";

const NOW = new Date("2026-10-01T02:00:00Z");
const options = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };
const line = { ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "500" };

async function business() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  return { actor };
}

async function customer(actor: OrgActor, displayName: string) {
  const created = await createCustomer(actor, { displayName }, testDb());
  if (!created.ok) throw new Error("customer");
  return created.customer.id;
}

async function quote(actor: OrgActor, customerId: string, { send = true } = {}) {
  const saved = await saveQuoteDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate: "2026-10-01", validUntil: "2026-10-15", notes: "", terms: "", lines: [line] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("quote");
  if (send) {
    const sent = await sendQuote(actor, saved.quote.id, options, testDb());
    if (!sent.ok) throw new Error("send");
  }
  return saved.quote.id;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("when a customer's quotations last changed", () => {
  it("is the latest change to a sent quotation, per customer, and ignores drafts", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");
    const pedro = await customer(actor, "Pedro Reyes");
    await quote(actor, juan);
    await quote(actor, maria);
    await quote(actor, pedro, { send: false }); // only a draft: nothing happened with them yet

    const rows = await lastQuoteChanges(actor, [juan, maria, pedro], testDb());
    expect(rows.map((row) => row.customerId).sort()).toEqual([juan, maria].sort());
    expect(rows.every((row) => row.at instanceof Date && !Number.isNaN(row.at.getTime()))).toBe(true);
    expect(await lastQuoteChanges(actor, [], testDb())).toEqual([]);
  });

  it("is the latest of a customer's quotations, not the earliest", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const older = await quote(actor, juan);
    const newer = await quote(actor, juan);
    await testDb().update(quotes).set({ updatedAt: new Date("2026-01-01T00:00:00Z") }).where(eq(quotes.id, older));
    await testDb().update(quotes).set({ updatedAt: new Date("2026-05-05T00:00:00Z") }).where(eq(quotes.id, newer));

    const [row] = await lastQuoteChanges(actor, [juan], testDb());
    expect(row?.at.toISOString()).toBe("2026-05-05T00:00:00.000Z");
  });

  it("still counts a quotation that was sent and is being revised, from when it was sent, and not the edits to the draft", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const id = await quote(actor, juan);
    expect((await reviseQuote(actor, id, testDb(), NOW)).ok).toBe(true);
    // It is a draft again; the business has been working on it since it went out.
    await testDb()
      .update(quotes)
      .set({ sentAt: new Date("2026-03-03T00:00:00Z"), updatedAt: new Date("2026-09-09T00:00:00Z") })
      .where(eq(quotes.id, id));

    const [row] = await lastQuoteChanges(actor, [juan], testDb());
    expect(row?.customerId).toBe(juan);
    expect(row?.at.toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });

  it("does not count a quotation that was called off before it was ever sent", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const id = await quote(actor, juan, { send: false });
    expect((await cancelQuote(actor, id, "Changed my mind", testDb())).ok).toBe(true);

    expect(await lastQuoteChanges(actor, [juan], testDb())).toEqual([]);
  });

  it("never shows another business's customers", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    await quote(actor, juan);

    const other = await business();
    expect(await lastQuoteChanges(other.actor, [juan], testDb())).toEqual([]);
  });
});

describe("a customer's own quotations in the list", () => {
  it("can be limited to one customer", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");
    await quote(actor, juan, { send: false });
    await quote(actor, juan);
    await quote(actor, maria);

    const list = await listQuotes(actor, { customerId: juan, pageSize: 10 }, testDb());
    expect(list.quotes).toHaveLength(2);
    expect(list.quotes.map((row) => row.customerName)).toEqual(["Juan Dela Cruz", "Juan Dela Cruz"]);
    // `total` is still everything the business has, so a screen can tell "none for them" from "none at all".
    expect(list.total).toBe(3);
    expect(list.matching).toBe(2);

    const other = await business();
    expect((await listQuotes(other.actor, { customerId: juan }, testDb())).quotes).toEqual([]);
  });
});
