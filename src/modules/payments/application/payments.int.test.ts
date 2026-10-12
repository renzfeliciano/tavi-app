import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  fillTestOutbox,
  listAllAuditEvents,
  listAllOutboxMessages,
  resetTables,
  testDb,
} from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { DOCUMENT_EMAIL_LIMIT, documentEmailLimitMessage } from "@/modules/notifications";
import { editIssuedInvoice, getInvoice, getSharedInvoice, issueInvoice, saveInvoiceDraft, voidInvoice } from "@/modules/invoices";
import { listInvoicePayments, listPayments, listPaymentsForSharedInvoice, recordPayment, voidPayment } from "./payments";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const market = MARKETS.PH;
const pay = (overrides: Record<string, string> = {}) => ({
  amount: "1,000",
  withheld: "",
  paidOn: "2026-10-01",
  method: "ewallet",
  reference: "GC-1",
  institution: "",
  payer: "",
  paidTime: "",
  chequeDate: "",
  notes: "",
  ...overrides,
});

async function sentInvoice(role: Role = "owner", dueDate = "2026-10-16", into?: OrgActor) {
  let actor: OrgActor;
  if (into) actor = into;
  else {
    const org = await createTestOrganization(testDb(), { name: "Santos Aircon", email: "billing@santos.example" });
    const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
    await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
    actor = { organizationId: org.id, userId: user.id, role };
  }
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz", email: "juan@example.com" }, testDb());
  if (!customer.ok) throw new Error("customer");
  const input = {
    customerId: customer.customer.id,
    currency: "PHP",
    issueDate: "2026-09-01",
    dueDate,
    notes: "",
    terms: "",
    lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
  };
  const saved = await saveInvoiceDraft(actor, null, input, { locale: "en-PH" }, testDb());
  if (!saved.ok) throw new Error("draft");
  const sent = await issueInvoice(
    actor,
    saved.invoice.id,
    { sender: { emailVerified: true }, market, appUrl: "https://tavi.example", email: null, now: NOW },
    testDb(),
  );
  if (!sent.ok) throw new Error("issue");
  return { actor, id: saved.invoice.id, input, token: sent.url.split("/i/")[1] ?? "" };
}

const record = (actor: OrgActor, id: string, raw = pay(), recipients: string[] = []) =>
  recordPayment(actor, id, raw, { recipients, market, now: NOW }, testDb());

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("recordPayment", () => {
  it("keeps the proof of payment as typed and shows it on every list that carries the payment", async () => {
    const { actor, id } = await sentInvoice();
    const raw = pay({ reference: "  7845 2210 9  ", institution: " GCash ", payer: " Juan D.C. ", paidTime: "14:30" });
    expect(await record(actor, id, raw)).toMatchObject({ ok: true });

    const proof = { reference: "7845 2210 9", institution: "GCash", payerName: "Juan D.C.", paidTime: "14:30", chequeDate: null };
    expect((await listInvoicePayments(actor, id, testDb()))[0]).toMatchObject(proof);
    expect((await listPayments(actor, {}, testDb())).payments[0]).toMatchObject(proof);
    expect((await listPaymentsForSharedInvoice(actor.organizationId, id, testDb()))[0]).toMatchObject(proof);
  });

  it("keeps a post-dated cheque's date, and a deposit slip's number and bank", async () => {
    const { actor, id } = await sentInvoice();
    await record(actor, id, pay({ amount: "500", method: "cheque", reference: "0001234", institution: "BDO", chequeDate: "2026-10-20" }));
    await record(actor, id, pay({ amount: "500", method: "bank_deposit", reference: "SLIP-88", institution: "BPI" }));
    const rows = await listInvoicePayments(actor, id, testDb());
    expect(rows.find((r) => r.method === "cheque")).toMatchObject({ reference: "0001234", institution: "BDO", chequeDate: "2026-10-20" });
    expect(rows.find((r) => r.method === "bank_deposit")).toMatchObject({ reference: "SLIP-88", institution: "BPI", chequeDate: null });
  });

  it("rejects a bad time and records nothing", async () => {
    const { actor, id } = await sentInvoice();
    expect(await record(actor, id, pay({ paidTime: "25:99" }))).toMatchObject({ ok: false });
    expect(await listPayments(actor, {}, testDb())).toMatchObject({ payments: [] });
  });

  it("won't email an acknowledgement past the business's hourly limit, and records nothing", async () => {
    const { actor, id } = await sentInvoice();
    await fillTestOutbox(actor.organizationId, DOCUMENT_EMAIL_LIMIT.max);

    expect(await record(actor, id, pay(), ["juan@example.com"])).toEqual({
      ok: false,
      error: documentEmailLimitMessage("Record it without emailing the acknowledgement"),
    });
    expect(await listPayments(actor, {}, testDb())).toMatchObject({ payments: [] });
    expect(await record(actor, id, pay(), [])).toMatchObject({ ok: true });
  });

  it("numbers an acknowledgement, part-pays the invoice and audits it", async () => {
    const { actor, id } = await sentInvoice();
    expect(await record(actor, id)).toMatchObject({
      ok: true,
      receiptNumber: "REC-000001",
      status: "PARTIALLY_PAID",
      balanceMinor: 200000,
    });
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ status: "PARTIALLY_PAID", amountPaidMinor: 100000 });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "payment.recorded",
      metadata: { receiptNumber: "REC-000001", amountMinor: 100000, invoiceStatus: "PARTIALLY_PAID" },
    });
  });

  it("closes the invoice when cash plus tax withheld (Form 2307) covers it, and the link then lasts 90 days", async () => {
    const { actor, id, token } = await sentInvoice();
    await record(actor, id, pay({ amount: "2,940", withheld: "60" }));
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ status: "PAID", amountPaidMinor: 300000 });
    expect((await getSharedInvoice(token, testDb()))?.invoice.status).toBe("PAID");
  });

  it("won't overpay, and won't take payments on a paid, void or draft invoice", async () => {
    const { actor, id } = await sentInvoice();
    expect(await record(actor, id, pay({ amount: "3,000.01" }))).toEqual({
      ok: false,
      errors: { amount: "That's more than the balance due. Record at most the balance." },
    });
    await record(actor, id, pay({ amount: "3,000" }));
    expect(await record(actor, id)).toEqual({ ok: false, error: "This is already paid in full." });

    const other = await sentInvoice();
    await voidInvoice(other.actor, other.id, "Duplicate", testDb());
    expect(await record(other.actor, other.id)).toMatchObject({ ok: false, error: expect.stringContaining("isn't void") });
  });

  it("keeps an overdue invoice overdue until it's fully paid", async () => {
    const { actor, id } = await sentInvoice("owner", "2026-09-15");
    await record(actor, id);
    expect((await getInvoice(actor, id, testDb()))?.status).toBe("OVERDUE");
    await record(actor, id, pay({ amount: "2,000" }));
    expect((await getInvoice(actor, id, testDb()))?.status).toBe("PAID");
  });

  it("locks the invoice against edits once anything is paid (D7)", async () => {
    const { actor, id, input } = await sentInvoice();
    await record(actor, id);
    expect(await editIssuedInvoice(actor, id, input, { locale: "en-PH" }, testDb(), NOW)).toMatchObject({ ok: false });
  });

  it("emails the customer an acknowledgement when asked, with the notice and disclaimer", async () => {
    const { actor, id } = await sentInvoice();
    await record(actor, id, pay(), ["juan@example.com"]);
    const [message] = await listAllOutboxMessages(testDb());
    expect(message?.payload).toMatchObject({ to: "juan@example.com", subject: "Payment received: Billing statement INV-000001" });
    expect(JSON.stringify(message?.payload)).toContain("Not a BIR official receipt.");
  });

  it("emails every recipient once (the customer plus others), de-duplicated", async () => {
    const { actor, id } = await sentInvoice();
    expect(await record(actor, id, pay(), ["Juan@example.com", "accounts@example.com", "juan@example.com"])).toMatchObject({ ok: true });
    const messages = await listAllOutboxMessages(testDb());
    expect(messages.map((m) => (m.payload as { to: string }).to).sort()).toEqual(["accounts@example.com", "juan@example.com"]);
  });

  it("can email someone who isn't on the invoice", async () => {
    const { actor, id } = await sentInvoice();
    await record(actor, id, pay(), ["bookkeeper@example.com"]);
    const [message] = await listAllOutboxMessages(testDb());
    expect(message?.payload).toMatchObject({ to: "bookkeeper@example.com" });
  });

  it("rejects an invalid or excessive recipient list and records nothing", async () => {
    const { actor, id } = await sentInvoice();
    expect(await record(actor, id, pay(), ["not-an-email"])).toMatchObject({ ok: false, errors: { recipients: expect.any(String) } });
    const many = Array.from({ length: 6 }, (_, i) => `p${i}@example.com`);
    expect(await record(actor, id, pay(), many)).toMatchObject({ ok: false, errors: { recipients: expect.any(String) } });
    expect(await listPayments(actor, {}, testDb())).toMatchObject({ payments: [] });
  });

  it("checks the hourly limit against the whole list", async () => {
    const { actor, id } = await sentInvoice();
    await fillTestOutbox(actor.organizationId, DOCUMENT_EMAIL_LIMIT.max - 1);
    expect(await record(actor, id, pay(), ["a@example.com", "b@example.com"])).toMatchObject({ ok: false });
    expect(await record(actor, id, pay(), ["a@example.com"])).toMatchObject({ ok: true });
  });

  it("needs the record permission (members can't)", async () => {
    const { id } = await sentInvoice();
    const member = await sentInvoice("member");
    await expect(record(member.actor, id)).rejects.toThrow();
  });
});

describe("recordPayment idempotency", () => {
  const KEY = "3f0c5a52-9b1e-4d3a-8f55-2d1f0a7c9e11";
  const keyed = (actor: OrgActor, id: string, raw = pay(), idempotencyKey: string | null = KEY) =>
    recordPayment(actor, id, raw, { recipients: [], market, now: NOW, idempotencyKey }, testDb());

  it("records a repeated request once and answers the repeat with the first result", async () => {
    const { actor, id } = await sentInvoice();
    const first = await keyed(actor, id);
    const again = await keyed(actor, id);
    expect(first).toMatchObject({ ok: true, receiptNumber: "REC-000001", balanceMinor: 200000 });
    expect(again).toEqual(first);
    const rows = await listInvoicePayments(actor, id, testDb());
    expect(rows).toHaveLength(1);
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ amountPaidMinor: 100000 });
  });

  it("still answers a retry after the invoice has been paid in full", async () => {
    const { actor, id } = await sentInvoice();
    const first = await keyed(actor, id, pay({ amount: "3,000" }));
    expect(first).toMatchObject({ ok: true, status: "PAID" });
    expect(await keyed(actor, id, pay({ amount: "3,000" }))).toEqual(first);
    expect(await listInvoicePayments(actor, id, testDb())).toHaveLength(1);
  });

  it("treats a different key (a new attempt) as a new payment", async () => {
    const { actor, id } = await sentInvoice();
    await keyed(actor, id, pay(), KEY);
    expect(await keyed(actor, id, pay(), "another-attempt-0002")).toMatchObject({ ok: true, receiptNumber: "REC-000002" });
    expect(await listInvoicePayments(actor, id, testDb())).toHaveLength(2);
  });

  it("refuses a key that was used for a different invoice of the business, and records nothing", async () => {
    const { actor, id } = await sentInvoice();
    await keyed(actor, id);
    const other = await sentInvoice("owner", "2026-10-16", actor);
    expect(await keyed(actor, other.id)).toMatchObject({ ok: false });
    expect(await listInvoicePayments(actor, other.id, testDb())).toHaveLength(0);
  });

  it("keeps keys separate per business", async () => {
    const mine = await sentInvoice();
    await keyed(mine.actor, mine.id);
    const theirs = await sentInvoice();
    expect(await keyed(theirs.actor, theirs.id)).toMatchObject({ ok: true });
    expect(await listInvoicePayments(theirs.actor, theirs.id, testDb())).toHaveLength(1);
  });

  it("keeps working without a key, as before", async () => {
    const { actor, id } = await sentInvoice();
    await keyed(actor, id, pay(), null);
    await keyed(actor, id, pay(), null);
    expect(await listInvoicePayments(actor, id, testDb())).toHaveLength(2);
  });

  it("rejects a malformed key", async () => {
    const { actor, id } = await sentInvoice();
    expect(await keyed(actor, id, pay(), "no")).toMatchObject({ ok: false, error: expect.stringContaining("try again") });
    expect(await listInvoicePayments(actor, id, testDb())).toHaveLength(0);
  });
});

describe("voidPayment", () => {
  it("voids with a reason, keeps the record, and reopens the invoice", async () => {
    const { actor, id, token } = await sentInvoice();
    const paid = await record(actor, id, pay({ amount: "3,000" }));
    if (!paid.ok) throw new Error("pay");
    expect(await voidPayment(actor, paid.paymentId, " ", testDb(), NOW)).toEqual({
      ok: false,
      errors: { reason: "Give a reason. It's kept with the record." },
    });
    expect(await voidPayment(actor, paid.paymentId, "Bounced transfer", testDb(), NOW)).toEqual({ ok: true, status: "SENT" });
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ status: "SENT", amountPaidMinor: 0 });
    expect(await listInvoicePayments(actor, id, testDb())).toMatchObject([{ voidReason: "Bounced transfer" }]);
    expect(await listPaymentsForSharedInvoice(actor.organizationId, id, testDb())).toEqual([]);
    expect(await getSharedInvoice(token, testDb())).not.toBeNull();
    expect(await voidPayment(actor, paid.paymentId, "Again", testDb(), NOW)).toEqual({
      ok: false,
      error: "This payment is already void.",
    });
  });

  it("never touches another business's payment", async () => {
    const { actor, id } = await sentInvoice();
    const paid = await record(actor, id);
    if (!paid.ok) throw new Error("pay");
    const other = await sentInvoice();
    expect(await voidPayment(other.actor, paid.paymentId, "x", testDb(), NOW)).toEqual({ ok: false, notFound: true });
    expect((await listPayments(other.actor, {}, testDb())).total).toBe(0);
  });
});
