import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { paymentsReceivedSince, recordPayment } from "@/modules/payments";
import {
  countDraftQuotes,
  decideSharedQuote,
  getSharedQuote,
  quotePipeline,
  quoteProgress,
  quotesNeedingAttention,
  recordSharedQuoteOpen,
  saveQuoteDraft,
  sendQuote,
  sharedQuoteContentHash,
} from "@/modules/quotes";
import { convertQuoteToInvoice } from "./conversion";
import { countOverdueInvoices, invoiceMoneySummary, invoicePipeline, overdueInvoices, recurringDraftsWaiting } from "./attention";
import { saveInvoiceDraft } from "./invoices";
import { invoices } from "../schema";
import { issueInvoice } from "./issuing";
import { createSchedule, runDueSchedules } from "./recurring";
import { issuedBill, recurringScene } from "./recurring-fixtures";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const TODAY = "2026-10-01";
const FUTURE = new Date("2030-01-01T00:00:00Z");
const options = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };
const line = (unitPrice: string) => ({ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice });

async function business() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!customer.ok) throw new Error("customer");
  return { actor, customerId: customer.customer.id };
}

async function invoice(actor: OrgActor, customerId: string, { currency = "PHP", dueDate = "2026-10-16", price = "1,000" } = {}) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    { customerId, currency, issueDate: "2026-09-01", dueDate, notes: "", terms: "", lines: [line(price)] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("invoice");
  await issueInvoice(actor, saved.invoice.id, options, testDb());
  return saved.invoice.id;
}

async function quote(actor: OrgActor, customerId: string, { send = true } = {}) {
  const saved = await saveQuoteDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate: TODAY, validUntil: "2026-10-15", notes: "", terms: "", lines: [line("500")] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("quote");
  if (!send) return { id: saved.quote.id, token: "" };
  const sent = await sendQuote(actor, saved.quote.id, options, testDb());
  if (!sent.ok) throw new Error("send");
  return { id: saved.quote.id, token: sent.url.split("/q/")[1] ?? "" };
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("invoice money and overdue", () => {
  it("totals what's owed and overdue per currency, never across currencies", async () => {
    const { actor, customerId } = await business();
    const due = await invoice(actor, customerId, { price: "1,000" });
    await invoice(actor, customerId, { dueDate: "2026-09-15", price: "2,000" });
    await invoice(actor, customerId, { currency: "USD", dueDate: "2026-09-20", price: "50" });
    await recordPayment(actor, due, { amount: "400", withheld: "", paidOn: TODAY, method: "cash", reference: "", institution: "", payer: "", paidTime: "", chequeDate: "", notes: "" }, { recipients: [], market: MARKETS.PH, now: NOW }, testDb());

    expect(await invoiceMoneySummary(actor, { today: TODAY }, testDb())).toEqual([
      { currency: "PHP", outstandingMinor: 260000, overdueMinor: 200000, outstandingCount: 2, overdueCount: 1, oldestOverdueDue: "2026-09-15" },
      { currency: "USD", outstandingMinor: 5000, overdueMinor: 5000, outstandingCount: 1, overdueCount: 1, oldestOverdueDue: "2026-09-20" },
    ]);
    const overdue = await overdueInvoices(actor, { today: TODAY, limit: 5 }, testDb());
    expect(overdue.map((i) => [i.number, i.balanceMinor, i.customerName])).toEqual([
      ["INV-000002", 200000, "Juan Dela Cruz"],
      ["INV-000003", 5000, "Juan Dela Cruz"],
    ]);
    expect(await paymentsReceivedSince(actor, "2026-09-01", testDb())).toEqual([{ currency: "PHP", receivedMinor: 40000, paymentCount: 1 }]);

    const other = await business();
    expect(await invoiceMoneySummary(other.actor, { today: TODAY }, testDb())).toEqual([]);
  });
});

describe("sidebar counts", () => {
  it("counts overdue billing statements and draft quotations for this business only", async () => {
    const { actor, customerId } = await business();
    expect(await countOverdueInvoices(actor, { today: TODAY }, testDb())).toBe(0);
    expect(await countDraftQuotes(actor, testDb())).toBe(0);

    const paid = await invoice(actor, customerId, { dueDate: "2026-09-15" });
    await invoice(actor, customerId, { dueDate: "2026-09-20" });
    await invoice(actor, customerId, { dueDate: "2026-10-16" });
    await recordPayment(actor, paid, { amount: "1,000", withheld: "", paidOn: TODAY, method: "cash", reference: "", institution: "", payer: "", paidTime: "", chequeDate: "", notes: "" }, { recipients: [], market: MARKETS.PH, now: NOW }, testDb());
    // One settled, one past due, one not due yet: a single overdue statement.
    expect(await countOverdueInvoices(actor, { today: TODAY }, testDb())).toBe(1);

    await quote(actor, customerId, { send: false });
    await quote(actor, customerId, { send: false });
    await quote(actor, customerId);
    expect(await countDraftQuotes(actor, testDb())).toBe(2);

    const other = await business();
    expect(await countOverdueInvoices(other.actor, { today: TODAY }, testDb())).toBe(0);
    expect(await countDraftQuotes(other.actor, testDb())).toBe(0);
  });
});

describe("quotes needing attention", () => {
  it("finds approved-not-invoiced, unanswered and stale drafts, and tracks first-run progress", async () => {
    const { actor, customerId } = await business();
    expect(await quoteProgress(actor, testDb())).toEqual({ hasQuote: false, hasSentQuote: false });

    await quote(actor, customerId, { send: false });
    expect(await quoteProgress(actor, testDb())).toEqual({ hasQuote: true, hasSentQuote: false });
    const waiting = await quote(actor, customerId);
    const approved = await quote(actor, customerId);
    const shared = await getSharedQuote(approved.token, testDb());
    if (!shared) throw new Error("shared");
    await decideSharedQuote(
      approved.token,
      { kind: "approve", name: "Juan", accepted: true },
      { contentHash: sharedQuoteContentHash(shared.quote), ipAddress: null, userAgent: null, appUrl: "https://tavi.example", now: NOW },
      testDb(),
    );

    const window = { today: TODAY, followUpBefore: FUTURE, staleBefore: FUTURE, limit: 5 };
    const attention = await quotesNeedingAttention(actor, window, testDb());
    expect(attention.approvedNotInvoiced.map((q) => q.id)).toEqual([approved.id]);
    expect(attention.awaitingReply.map((q) => q.id)).toEqual([waiting.id]);
    expect(attention.staleDrafts).toHaveLength(1);
    expect(attention.staleDrafts[0]?.customerName).toBe("Juan Dela Cruz");
    expect(await quoteProgress(actor, testDb())).toEqual({ hasQuote: true, hasSentQuote: true });

    // Once invoiced, it's no longer waiting to be invoiced; a recent send isn't nagged.
    await convertQuoteToInvoice(actor, approved.id, testDb(), NOW);
    const later = await quotesNeedingAttention(actor, { ...window, followUpBefore: new Date("2020-01-01") }, testDb());
    expect(later.approvedNotInvoiced).toEqual([]);
    expect(later.awaitingReply).toEqual([]);
  });
});

async function approved(actor: OrgActor, customerId: string) {
  const made = await quote(actor, customerId);
  const shared = await getSharedQuote(made.token, testDb());
  if (!shared) throw new Error("shared");
  await decideSharedQuote(
    made.token,
    { kind: "approve", name: "Juan", accepted: true },
    { contentHash: sharedQuoteContentHash(shared.quote), ipAddress: null, userAgent: null, appUrl: "https://tavi.example", now: NOW },
    testDb(),
  );
  return made;
}

describe("pipelines", () => {
  it("counts quotations by stage with what each is worth, leaving out an approval that is already billed", async () => {
    const { actor, customerId } = await business();
    await quote(actor, customerId, { send: false });
    await quote(actor, customerId, { send: false });
    await quote(actor, customerId);
    const viewed = await quote(actor, customerId);
    await recordSharedQuoteOpen(viewed.token, testDb());
    await approved(actor, customerId);
    const billed = await approved(actor, customerId);
    await convertQuoteToInvoice(actor, billed.id, testDb(), NOW);

    const worth = (count: number) => ({ count, totals: count ? [{ currency: "PHP", count, totalMinor: count * 50_000 }] : [] });
    expect(await quotePipeline(actor, testDb())).toEqual({ drafts: worth(2), sent: worth(1), viewed: worth(1), approved: worth(1) });

    const other = await business();
    expect(await quotePipeline(other.actor, testDb())).toEqual({ drafts: worth(0), sent: worth(0), viewed: worth(0), approved: worth(0) });
  });

  it("counts billing statements as drafts, unpaid (part-paid too) and overdue, by their due dates, and leaves out the paid", async () => {
    const { actor, customerId } = await business();
    const draft = await saveInvoiceDraft(
      actor,
      null,
      { customerId, currency: "PHP", issueDate: "2026-09-01", dueDate: "2026-10-30", notes: "", terms: "", lines: [line("750")] },
      { locale: "en-PH" },
      testDb(),
    );
    if (!draft.ok) throw new Error("draft");
    await invoice(actor, customerId, { dueDate: "2026-10-16", price: "1,000" });
    await invoice(actor, customerId, { dueDate: TODAY, price: "500" }); // due today is not late yet
    const partly = await invoice(actor, customerId, { dueDate: "2026-10-20", price: "2,000" });
    await invoice(actor, customerId, { dueDate: "2026-09-15", price: "3,000" });
    const settled = await invoice(actor, customerId, { dueDate: "2026-09-10", price: "400" });
    const pay = (amount: string) => ({ amount, withheld: "", paidOn: TODAY, method: "cash", reference: "", institution: "", payer: "", paidTime: "", chequeDate: "", notes: "" });
    await recordPayment(actor, partly, pay("500"), { recipients: [], market: MARKETS.PH, now: NOW }, testDb());
    await recordPayment(actor, settled, pay("400"), { recipients: [], market: MARKETS.PH, now: NOW }, testDb());

    expect(await invoicePipeline(actor, { today: TODAY }, testDb())).toEqual({
      drafts: { count: 1, totals: [{ currency: "PHP", count: 1, totalMinor: 75_000 }] },
      unpaid: { count: 3, totals: [{ currency: "PHP", count: 3, totalMinor: 100_000 + 50_000 + 150_000 }] },
      overdue: { count: 1, totals: [{ currency: "PHP", count: 1, totalMinor: 300_000 }] },
    });
  });
});

// The dashboard's "recurring statements to review" (spec 7): drafts a schedule made that nobody has sent yet.
describe("recurringDraftsWaiting", () => {
  async function repeating() {
    const scene = await recurringScene();
    const billId = await issuedBill(scene.actor, scene.customerId);
    const made = await createSchedule(scene.actor, billId, { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01" }, { today: "2026-10-14" }, testDb());
    if (!made.ok) throw new Error("schedule");
    return { ...scene, scheduleId: made.id };
  }

  it("counts the drafts schedules made, and not the bills a person made or the ones already sent", async () => {
    const { actor, orgId, customerId } = await repeating();
    await runDueSchedules(orgId, "2026-11-01", testDb());
    await runDueSchedules(orgId, "2026-12-01", testDb());
    // A draft started by hand is not a recurring one.
    const byHand = await saveInvoiceDraft(
      actor,
      null,
      { customerId, currency: "PHP", issueDate: "2026-09-01", dueDate: "2026-10-30", notes: "", terms: "", lines: [line("750")] },
      { locale: "en-PH" },
      testDb(),
    );
    if (!byHand.ok) throw new Error("draft");

    expect(await recurringDraftsWaiting(actor, testDb())).toBe(2);
  });

  it("drops a draft from the count once it is sent", async () => {
    const { actor, orgId, scheduleId } = await repeating();
    await runDueSchedules(orgId, "2026-11-01", testDb());
    const [made] = await testDb().select({ id: invoices.id }).from(invoices).where(eq(invoices.recurringScheduleId, scheduleId));
    await issueInvoice(actor, made?.id ?? "", options, testDb());

    expect(await recurringDraftsWaiting(actor, testDb())).toBe(0);
  });

  it("counts only the actor's business", async () => {
    const mine = await repeating();
    const theirs = await repeating();
    await runDueSchedules(mine.orgId, "2026-11-01", testDb());
    await runDueSchedules(theirs.orgId, "2026-11-01", testDb());
    await runDueSchedules(theirs.orgId, "2026-12-01", testDb());

    expect(await recurringDraftsWaiting(mine.actor, testDb())).toBe(1);
  });
});
