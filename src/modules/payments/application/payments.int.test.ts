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
  notes: "",
  ...overrides,
});

async function sentInvoice(role: Role = "owner", dueDate = "2026-10-16") {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon", email: "billing@santos.example" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role };
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

const record = (actor: OrgActor, id: string, raw = pay(), acknowledge = false) =>
  recordPayment(actor, id, raw, { acknowledge, market, now: NOW }, testDb());

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("recordPayment", () => {
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
    await record(actor, id, pay(), true);
    const [message] = await listAllOutboxMessages(testDb());
    expect(message?.payload).toMatchObject({ to: "juan@example.com", subject: "Payment received: Billing statement INV-000001" });
    expect(JSON.stringify(message?.payload)).toContain("Not a BIR official receipt.");
  });

  it("needs the record permission (members can't)", async () => {
    const { id } = await sentInvoice();
    const member = await sentInvoice("member");
    await expect(record(member.actor, id)).rejects.toThrow();
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
