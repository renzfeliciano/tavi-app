import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { recordPayment } from "@/modules/payments";
import { cancelInvoice } from "./corrections";
import { customerMoney, lastInvoiceChanges } from "./customer-figures";
import { listInvoices, saveInvoiceDraft } from "./invoices";
import { invoices } from "../schema";
import { issueInvoice } from "./issuing";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const TODAY = "2026-10-01";
const options = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };
const line = (unitPrice: string) => ({ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice });

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

async function draft(actor: OrgActor, customerId: string, { currency = "PHP", dueDate = "2026-10-16", price = "1,000" } = {}) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    { customerId, currency, issueDate: "2026-09-01", dueDate, notes: "", terms: "", lines: [line(price)] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("invoice");
  return saved.invoice.id;
}

async function issued(actor: OrgActor, customerId: string, extra: { currency?: string; dueDate?: string; price?: string } = {}) {
  const id = await draft(actor, customerId, extra);
  await issueInvoice(actor, id, options, testDb());
  return id;
}

const pay = (actor: OrgActor, invoiceId: string, amount: string) =>
  recordPayment(
    actor,
    invoiceId,
    { amount, withheld: "", paidOn: TODAY, method: "cash", reference: "", institution: "", payer: "", paidTime: "", chequeDate: "", notes: "" },
    { recipients: [], market: MARKETS.PH, now: NOW },
    testDb(),
  );

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("what a customer has been billed, has paid and still owes", () => {
  it("adds up each customer's issued statements per currency: billed, paid, owed, overdue and how many", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");

    await issued(actor, juan, { price: "1,000" }); // not due yet, nothing paid
    const late = await issued(actor, juan, { dueDate: "2026-09-15", price: "2,000" }); // past due
    await pay(actor, late, "500"); // part-paid, still late
    const settled = await issued(actor, juan, { price: "3,000" });
    await pay(actor, settled, "3,000"); // paid in full
    await issued(actor, juan, { currency: "USD", dueDate: "2026-09-20", price: "50" });
    await draft(actor, juan, { price: "9,999" }); // never issued: not billed
    const cancelled = await issued(actor, juan, { price: "7,000" });
    await cancelInvoice(actor, cancelled, "Job called off", testDb()); // never happened: not billed
    await issued(actor, maria, { price: "400" });

    expect(await customerMoney(actor, [juan], { today: TODAY }, testDb())).toEqual([
      { customerId: juan, currency: "PHP", billedMinor: 600000, paidMinor: 350000, owedMinor: 250000, overdueMinor: 150000, count: 3 },
      { customerId: juan, currency: "USD", billedMinor: 5000, paidMinor: 0, owedMinor: 5000, overdueMinor: 5000, count: 1 },
    ]);
  });

  it("answers for exactly the customers asked about, in one call", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");
    const nobody = await customer(actor, "Pedro Reyes");
    await issued(actor, juan, { price: "1,000" });
    await issued(actor, maria, { price: "400" });

    const rows = await customerMoney(actor, [juan, nobody, maria], { today: TODAY }, testDb());
    expect(Object.fromEntries(rows.map((row) => [row.customerId, row.owedMinor]))).toEqual({
      [juan]: 100000,
      [maria]: 40000,
    });
    expect(rows).toHaveLength(2); // Pedro has nothing issued, so no row
    expect(await customerMoney(actor, [], { today: TODAY }, testDb())).toEqual([]);
  });

  it("never shows another business's customers or money", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    await issued(actor, juan, { price: "1,000" });

    const other = await business();
    expect(await customerMoney(other.actor, [juan], { today: TODAY }, testDb())).toEqual([]);
    expect(await lastInvoiceChanges(other.actor, [juan], testDb())).toEqual([]);
  });
});

describe("when a customer's billing statements last changed", () => {
  it("is the latest change to an issued statement, per customer, and ignores drafts", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");
    const pedro = await customer(actor, "Pedro Reyes");
    const first = await issued(actor, juan, { price: "1,000" });
    await issued(actor, maria, { price: "400" });
    await draft(actor, pedro, { price: "300" }); // only a draft: no activity yet

    const before = await lastInvoiceChanges(actor, [juan, maria, pedro], testDb());
    expect(before.map((row) => row.customerId).sort()).toEqual([juan, maria].sort());

    // A payment changes the statement, so it counts as activity on that customer.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await pay(actor, first, "100");
    const after = await lastInvoiceChanges(actor, [juan, maria], testDb());
    const at = (rows: typeof after, id: string) => rows.find((row) => row.customerId === id)?.at.getTime() ?? 0;
    expect(at(after, juan)).toBeGreaterThan(at(before, juan));
    expect(at(after, maria)).toBe(at(before, maria));
  });
});

describe("when a customer's billing statements last changed, across several", () => {
  it("is the latest of a customer's statements, not the earliest", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const older = await issued(actor, juan, { price: "1,000" });
    const newer = await issued(actor, juan, { price: "400" });
    await testDb().update(invoices).set({ updatedAt: new Date("2026-01-01T00:00:00Z") }).where(eq(invoices.id, older));
    await testDb().update(invoices).set({ updatedAt: new Date("2026-05-05T00:00:00Z") }).where(eq(invoices.id, newer));

    const [row] = await lastInvoiceChanges(actor, [juan], testDb());
    expect(row?.at.toISOString()).toBe("2026-05-05T00:00:00.000Z");
  });
});

describe("a customer's own statements in the list", () => {
  it("can be limited to one customer", async () => {
    const { actor } = await business();
    const juan = await customer(actor, "Juan Dela Cruz");
    const maria = await customer(actor, "Maria Santos");
    const one = await draft(actor, juan);
    await draft(actor, maria);
    await issued(actor, juan);

    const list = await listInvoices(actor, { customerId: juan, pageSize: 10 }, testDb());
    expect(list.invoices).toHaveLength(2);
    expect(list.invoices.map((invoice) => invoice.customerName)).toEqual(["Juan Dela Cruz", "Juan Dela Cruz"]);
    expect(list.invoices.map((invoice) => invoice.id)).toContain(one);
    // `total` is still everything the business has, so a screen can tell "none for them" from "none at all".
    expect(list.total).toBe(3);
    expect(list.matching).toBe(2);

    const other = await business();
    expect((await listInvoices(other.actor, { customerId: juan }, testDb())).invoices).toEqual([]);
  });
});
