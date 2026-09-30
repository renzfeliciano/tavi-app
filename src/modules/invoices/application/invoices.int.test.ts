import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  listAllOutboxMessages,
  resetTables,
  testDb,
} from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import {
  cancelQuote,
  decideSharedQuote,
  getQuote,
  getSharedQuote,
  saveQuoteDraft,
  sendQuote,
  sharedQuoteContentHash,
} from "@/modules/quotes";
import { convertQuoteToInvoice } from "./conversion";
import { deleteDraftInvoice, getInvoice, listInvoices, saveInvoiceDraft } from "./invoices";
import { createInvoiceLink, getSharedInvoice, issueInvoice, recordSharedInvoiceOpen } from "./issuing";

const APP_URL = "https://tavi.example";
const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const VERIFIED = { emailVerified: true };

async function setup(role: Role = "owner") {
  const org = await createTestOrganization(testDb(), {
    name: "Santos Aircon",
    email: "billing@santos.example",
    paymentInstructions: "GCash 0917 123 4567",
    paymentTermsDays: 15,
  });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz", email: "juan@example.com" }, testDb());
  if (!customer.ok) throw new Error("customer");
  return { actor, customerId: customer.customer.id };
}

const draftInput = (customerId: string, overrides: Record<string, unknown> = {}) => ({
  customerId,
  currency: "PHP",
  issueDate: "2026-10-01",
  dueDate: "2026-10-16",
  notes: "",
  terms: "",
  lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
  ...overrides,
});

async function draftInvoice(actor: OrgActor, customerId: string, overrides: Record<string, unknown> = {}) {
  const saved = await saveInvoiceDraft(actor, null, draftInput(customerId, overrides), { locale: "en-PH" }, testDb());
  if (!saved.ok) throw new Error(`draft: ${JSON.stringify(saved)}`);
  return saved.invoice;
}

const issueOptions = (overrides: Partial<Parameters<typeof issueInvoice>[2]> = {}) => ({
  sender: VERIFIED,
  market: MARKETS.PH,
  appUrl: APP_URL,
  email: null,
  now: NOW,
  ...overrides,
});

async function approvedQuote(actor: OrgActor, customerId: string) {
  const saved = await saveQuoteDraft(
    actor,
    null,
    {
      customerId,
      currency: "PHP",
      issueDate: "2026-10-01",
      validUntil: "2026-10-15",
      notes: "Includes freon top-up.",
      terms: "50% down payment.",
      lines: [
        { ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" },
        { ...blankLine(), description: "Freon", quantity: "1", unitLabel: "pc", unitPrice: "800" },
      ],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("quote");
  const sent = await sendQuote(actor, saved.quote.id, { ...issueOptions(), email: null }, testDb());
  if (!sent.ok) throw new Error("send");
  const token = sent.url.split("/q/")[1] ?? "";
  const shared = await getSharedQuote(token, testDb());
  if (!shared) throw new Error("shared");
  const decided = await decideSharedQuote(
    token,
    { kind: "approve", name: "Juan Dela Cruz", accepted: true },
    { contentHash: sharedQuoteContentHash(shared.quote), ipAddress: null, userAgent: null, appUrl: APP_URL, now: NOW },
    testDb(),
  );
  if (!decided.ok) throw new Error("approve");
  return saved.quote.id;
}

const tokenOf = (url: string) => url.split("/i/")[1] ?? "";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("saveInvoiceDraft", () => {
  it("creates a draft with totals from the one calculation, and audits the creation", async () => {
    const { actor, customerId } = await setup();
    const invoice = await draftInvoice(actor, customerId);
    expect(invoice).toMatchObject({ status: "DRAFT", number: null, totalMinor: 300000, dueDate: "2026-10-16" });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "invoice.created", entityId: invoice.id });
    const detail = await getInvoice(actor, invoice.id, testDb());
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.lines[0]).toMatchObject({ description: "Aircon cleaning", quantity: 20000, totalMinor: 300000 });
  });

  it("rejects a due date before the invoice date", async () => {
    const { actor, customerId } = await setup();
    expect(
      await saveInvoiceDraft(actor, null, draftInput(customerId, { dueDate: "2026-09-30" }), { locale: "en-PH" }, testDb()),
    ).toEqual({ ok: false, errors: { dueDate: "Choose a due date on or after the invoice date." } });
  });

  it("never shows another business's invoice", async () => {
    const { actor, customerId } = await setup();
    const invoice = await draftInvoice(actor, customerId);
    const other = await setup();
    expect(await getInvoice(other.actor, invoice.id, testDb())).toBeNull();
    expect(await saveInvoiceDraft(other.actor, invoice.id, draftInput(other.customerId), { locale: "en-PH" }, testDb())).toEqual({
      ok: false,
      notFound: true,
    });
  });
});

describe("issueInvoice", () => {
  it("numbers the invoice, snapshots the customer and payment instructions, and opens a link", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    const result = await issueInvoice(actor, draft.id, issueOptions(), testDb());
    expect(result).toMatchObject({ ok: true, number: "INV-000001" });
    if (!result.ok) return;
    expect(result.url).toMatch(/^https:\/\/tavi\.example\/i\/[\w-]{43}$/);

    const invoice = await getInvoice(actor, draft.id, testDb());
    expect(invoice).toMatchObject({
      status: "SENT",
      number: "INV-000001",
      paymentInstructions: "GCash 0917 123 4567",
      customerSnapshot: { displayName: "Juan Dela Cruz", email: "juan@example.com" },
    });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "invoice.sent",
      metadata: { number: "INV-000001", channel: "link", status: "SENT" },
    });
    expect(await getSharedInvoice(tokenOf(result.url), testDb())).toMatchObject({ invoice: { id: draft.id } });
  });

  it("is OVERDUE straight away when issued after its due date", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId, { issueDate: "2026-09-01", dueDate: "2026-09-15" });
    await issueInvoice(actor, draft.id, issueOptions(), testDb());
    expect((await getInvoice(actor, draft.id, testDb()))?.status).toBe("OVERDUE");
  });

  it("emails the customer through the outbox, from the business", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    await issueInvoice(actor, draft.id, issueOptions({ email: { to: "Juan@Example.com", message: "Thanks!" } }), testDb());
    const [message] = await listAllOutboxMessages(testDb());
    expect(message?.payload).toMatchObject({
      to: "juan@example.com",
      subject: "Billing statement INV-000001 from Santos Aircon",
      replyTo: "billing@santos.example",
    });
    expect(JSON.stringify(message?.payload)).toContain("Due Oct 16, 2026");
  });

  it("needs a confirmed sender, a customer and an item, and happens once", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    expect(await issueInvoice(actor, draft.id, issueOptions({ sender: { emailVerified: false } }), testDb())).toMatchObject({
      ok: false,
      error: expect.stringContaining("Confirm your email address"),
    });
    const empty = await draftInvoice(actor, customerId, { customerId: "", lines: [] });
    expect(await issueInvoice(actor, empty.id, issueOptions(), testDb())).toEqual({
      ok: false,
      errors: { customerId: "Choose a customer before sending.", lines: "Add at least one item before sending." },
    });
    await issueInvoice(actor, draft.id, issueOptions(), testDb());
    expect(await issueInvoice(actor, draft.id, issueOptions(), testDb())).toEqual({
      ok: false,
      error: "This invoice was already sent.",
    });
  });
});

describe("convertQuoteToInvoice", () => {
  it("copies the approved quote into a draft invoice dated today with the payment terms", async () => {
    const { actor, customerId } = await setup();
    const quoteId = await approvedQuote(actor, customerId);
    const quote = await getQuote(actor, quoteId, testDb());

    const result = await convertQuoteToInvoice(actor, quoteId, testDb(), NOW);
    expect(result).toMatchObject({ ok: true, created: true });
    if (!result.ok) return;
    const invoice = await getInvoice(actor, result.invoiceId, testDb());
    expect(invoice).toMatchObject({
      status: "DRAFT",
      sourceQuoteId: quoteId,
      customerId,
      issueDate: "2026-10-01",
      dueDate: "2026-10-16",
      notes: "Includes freon top-up.",
      terms: "50% down payment.",
      totalMinor: quote?.totalMinor,
    });
    expect(invoice?.lines.map((l) => [l.description, l.totalMinor])).toEqual(
      quote?.lines.map((l) => [l.description, l.totalMinor]),
    );
    expect(await getQuote(actor, quoteId, testDb())).toMatchObject({ status: "APPROVED", convertedInvoiceId: result.invoiceId });
    const actions = (await listAllAuditEvents(testDb())).map((e) => e.action).slice(-2);
    expect(actions).toEqual(["quote.converted", "invoice.created"]);
  });

  it("finds the same invoice when converted twice", async () => {
    const { actor, customerId } = await setup();
    const quoteId = await approvedQuote(actor, customerId);
    const first = await convertQuoteToInvoice(actor, quoteId, testDb(), NOW);
    const second = await convertQuoteToInvoice(actor, quoteId, testDb(), NOW);
    expect(second).toEqual({ ok: true, invoiceId: first.ok ? first.invoiceId : "", created: false });
    expect((await listInvoices(actor, {}, testDb())).total).toBe(1);
  });

  it("converts only approved quotes", async () => {
    const { actor, customerId } = await setup();
    const saved = await saveQuoteDraft(
      actor,
      null,
      { customerId, currency: "PHP", issueDate: "2026-10-01", validUntil: "2026-10-15", notes: "", terms: "", lines: [] },
      { locale: "en-PH" },
      testDb(),
    );
    if (!saved.ok) throw new Error("quote");
    expect(await convertQuoteToInvoice(actor, saved.quote.id, testDb(), NOW)).toEqual({
      ok: false,
      error: "Only an approved quote can become an invoice.",
    });
  });

  it("stops the quote being cancelled, until the draft invoice is deleted", async () => {
    const { actor, customerId } = await setup();
    const quoteId = await approvedQuote(actor, customerId);
    const converted = await convertQuoteToInvoice(actor, quoteId, testDb(), NOW);
    if (!converted.ok) throw new Error("convert");
    expect(await cancelQuote(actor, quoteId, "", testDb())).toEqual({
      ok: false,
      error: "This quote is already an invoice. Void or cancel the invoice instead.",
    });

    expect(await deleteDraftInvoice(actor, converted.invoiceId, testDb())).toMatchObject({ ok: true });
    expect((await getQuote(actor, quoteId, testDb()))?.convertedInvoiceId).toBeNull();
    expect(await convertQuoteToInvoice(actor, quoteId, testDb(), NOW)).toMatchObject({ ok: true, created: true });
  });
});

describe("deleteDraftInvoice", () => {
  it("deletes a never-issued draft but not an issued invoice", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    const issued = await draftInvoice(actor, customerId);
    await issueInvoice(actor, issued.id, issueOptions(), testDb());

    expect(await deleteDraftInvoice(actor, draft.id, testDb())).toMatchObject({ ok: true });
    expect(await getInvoice(actor, draft.id, testDb())).toBeNull();
    expect(await deleteDraftInvoice(actor, issued.id, testDb())).toMatchObject({ ok: false });
  });
});

describe("customer links", () => {
  it("records the first open once, and never shows drafts", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    const issued = await issueInvoice(actor, draft.id, issueOptions(), testDb());
    if (!issued.ok) throw new Error("issue");
    await recordSharedInvoiceOpen(tokenOf(issued.url), testDb());
    await recordSharedInvoiceOpen(tokenOf(issued.url), testDb());

    expect((await getInvoice(actor, draft.id, testDb()))?.viewedAt).toBeInstanceOf(Date);
    expect((await listAllAuditEvents(testDb())).filter((e) => e.action === "invoice.viewed")).toHaveLength(1);
  });

  it("opens another link to an issued invoice, not to a draft", async () => {
    const { actor, customerId } = await setup();
    const draft = await draftInvoice(actor, customerId);
    expect(await createInvoiceLink(actor, draft.id, { appUrl: APP_URL }, testDb())).toEqual({
      ok: false,
      error: "Send the invoice first; its link opens then.",
    });
    await issueInvoice(actor, draft.id, issueOptions(), testDb());
    const link = await createInvoiceLink(actor, draft.id, { appUrl: APP_URL }, testDb());
    expect(link.ok && (await getSharedInvoice(tokenOf(link.url), testDb()))?.invoice.id).toBe(draft.id);
  });
});
