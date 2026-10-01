import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { paymentsReceivedSince, recordPayment } from "@/modules/payments";
import {
  decideSharedQuote,
  getSharedQuote,
  quoteProgress,
  quotesNeedingAttention,
  saveQuoteDraft,
  sendQuote,
  sharedQuoteContentHash,
} from "@/modules/quotes";
import { convertQuoteToInvoice } from "./conversion";
import { invoiceMoneySummary, overdueInvoices } from "./attention";
import { saveInvoiceDraft } from "./invoices";
import { issueInvoice } from "./issuing";

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
    await recordPayment(actor, due, { amount: "400", withheld: "", paidOn: TODAY, method: "cash", reference: "", notes: "" }, { acknowledge: false, market: MARKETS.PH, now: NOW }, testDb());

    expect(await invoiceMoneySummary(actor, { today: TODAY }, testDb())).toEqual([
      { currency: "PHP", outstandingMinor: 260000, overdueMinor: 200000 },
      { currency: "USD", outstandingMinor: 5000, overdueMinor: 5000 },
    ]);
    const overdue = await overdueInvoices(actor, { today: TODAY, limit: 5 }, testDb());
    expect(overdue.map((i) => [i.number, i.balanceMinor, i.customerName])).toEqual([
      ["INV-000002", 200000, "Juan Dela Cruz"],
      ["INV-000003", 5000, "Juan Dela Cruz"],
    ]);
    expect(await paymentsReceivedSince(actor, "2026-09-01", testDb())).toEqual([{ currency: "PHP", receivedMinor: 40000 }]);

    const other = await business();
    expect(await invoiceMoneySummary(other.actor, { today: TODAY }, testDb())).toEqual([]);
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
