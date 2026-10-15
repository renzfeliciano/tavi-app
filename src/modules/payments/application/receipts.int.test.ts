import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { organizations } from "@/db/schema";
import { closeTestDb, fillTestOutbox, listAllAuditEvents, listAllOutboxMessages, resetTables, testDb } from "@/db/testing";
import type { OrgActor } from "@/modules/authz";
import { archiveCustomer } from "@/modules/customers";
import { getInvoice } from "@/modules/invoices";
import { DOCUMENT_EMAIL_LIMIT } from "@/modules/notifications";
import type { RawReceipt } from "../domain/receipt-input";
import { issuedStatement, testBusiness, testCustomer, testMember } from "./certificate-fixtures";
import { listPayments, recordPayment } from "./payments";
import { emailReceipt, getReceipt, issueReceipt, listReceipts, voidReceipt } from "./receipts";

// Made-up data only. Runs on the test database (docs/superpowers/specs/2026-10-15-receipts-design.md, sections 2, 5 and 9).

const db = () => testDb();
const market = MARKETS.PH;
const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct, 10:00 in Manila
const raw = (overrides: Partial<RawReceipt & { customerId: string }> = {}): RawReceipt & { customerId: string } => ({
  customerId: "",
  kind: "collection",
  payer: "Maria Santos",
  amount: "1,500",
  receivedOn: "2026-10-01",
  method: "cash",
  reference: "",
  institution: "",
  paidTime: "",
  chequeDate: "",
  purpose: "Reimbursement of fuel",
  notes: "",
  ...overrides,
});
const issue = (
  actor: OrgActor,
  input = raw(),
  options: { recipients?: string[]; idempotencyKey?: string | null; now?: Date } = {},
) => issueReceipt(actor, input, { recipients: [], market, now: NOW, ...options }, db());
const issued = async (actor: OrgActor, input = raw()) => {
  const result = await issue(actor, input);
  if (!result.ok) throw new Error(`receipt: ${JSON.stringify(result)}`);
  return result;
};

beforeEach(() => resetTables());
afterAll(() => closeTestDb());

describe("issueReceipt", () => {
  it("issues a numbered receipt at once, from the same series as payment acknowledgements", async () => {
    const actor = await testBusiness();
    const customerId = await testCustomer(actor);
    const first = await issued(actor);
    expect(first.receiptNumber).toBe("REC-000001");

    const invoiceId = await issuedStatement(actor, customerId);
    const paid = await recordPayment(
      actor,
      invoiceId,
      { amount: "500", withheld: "", paidOn: "2026-10-01", method: "cash", reference: "", institution: "", payer: "", paidTime: "", chequeDate: "", notes: "" },
      { recipients: [], market, now: NOW },
      db(),
    );
    expect(paid).toMatchObject({ ok: true, receiptNumber: "REC-000002" });
    expect((await issued(actor)).receiptNumber).toBe("REC-000003");

    expect(await getReceipt(actor, first.receiptId, db())).toMatchObject({
      kind: "collection",
      receiptNumber: "REC-000001",
      payerName: "Maria Santos",
      amountMinor: 150_000,
      currency: "PHP",
      receivedOn: "2026-10-01",
      method: "cash",
      purpose: "Reimbursement of fuel",
      customerId: null,
      voidedAt: null,
      issuedBy: actor.userId,
    });
  });

  it("makes one receipt when the same attempt is sent twice", async () => {
    const actor = await testBusiness();
    const key = "11111111-1111-4111-8111-111111111111";
    const [a, b] = [await issue(actor, raw(), { idempotencyKey: key }), await issue(actor, raw(), { idempotencyKey: key })];
    expect(a).toMatchObject({ ok: true, receiptNumber: "REC-000001" });
    expect(b).toMatchObject({ ok: true, receiptNumber: "REC-000001" });
    expect((await listReceipts(actor, {}, db())).total).toBe(1);
  });

  it("gives two receipts issued at the same moment consecutive numbers", async () => {
    const actor = await testBusiness();
    const results = await Promise.all([issue(actor), issue(actor, raw({ payer: "Pedro Reyes" }))]);
    const numbers = results.map((r) => (r.ok ? r.receiptNumber : "")).sort();
    expect(numbers).toEqual(["REC-000001", "REC-000002"]);
  });

  it("takes no number when the receipt is refused", async () => {
    const actor = await testBusiness();
    expect(await issue(actor, raw({ amount: "0" }))).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
    const other = await testBusiness();
    const strangerId = await testCustomer(other);
    expect(await issue(actor, raw({ customerId: strangerId }))).toMatchObject({ ok: false, notFound: true });
    expect((await issued(actor)).receiptNumber).toBe("REC-000001");
  });

  it("refuses an archived customer", async () => {
    const actor = await testBusiness();
    const customerId = await testCustomer(actor);
    await archiveCustomer(actor, customerId, db());
    expect(await issue(actor, raw({ customerId }))).toMatchObject({ ok: false, error: expect.stringContaining("archived") });
  });

  it("prints the customer's name when one is chosen and no payer is typed", async () => {
    const actor = await testBusiness();
    const customerId = await testCustomer(actor, "Juan Dela Cruz");
    const { receiptId } = await issued(actor, raw({ customerId, payer: "" }));
    expect(await getReceipt(actor, receiptId, db())).toMatchObject({ customerId, payerName: "Juan Dela Cruz" });
  });

  it("accepts today in the business's time zone and refuses tomorrow, even just after local midnight", async () => {
    const actor = await testBusiness();
    const afterMidnight = new Date("2026-09-30T16:30:00Z"); // 00:30 on 1 Oct in Manila, still 30 Sep in UTC
    expect((await issue(actor, raw({ receivedOn: "2026-10-01" }), { now: afterMidnight })).ok).toBe(true);
    expect(await issue(actor, raw({ receivedOn: "2026-10-02" }), { now: afterMidnight })).toMatchObject({
      ok: false,
      errors: { receivedOn: expect.any(String) },
    });
  });

  it("keeps the business's details as they were when it was issued", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    await db().update(organizations).set({ name: "Renamed Business" }).where(eq(organizations.id, actor.organizationId));
    const receipt = await getReceipt(actor, receiptId, db());
    expect(receipt?.seller).toMatchObject({ name: "Santos Aircon" });
  });

  it("writes the audit event in the same transaction, and nothing on a refusal", async () => {
    const actor = await testBusiness();
    await issue(actor, raw({ purpose: "" }));
    expect((await listAllAuditEvents(db())).filter((e) => e.action === "receipt.issued")).toHaveLength(0);
    const { receiptId } = await issued(actor);
    const events = (await listAllAuditEvents(db())).filter((e) => e.action === "receipt.issued");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorType: "user", actorId: actor.userId, organizationId: actor.organizationId, entityType: "receipt", entityId: receiptId });
  });

  it("queues one email per address, and refuses everything when over the email limit", async () => {
    const actor = await testBusiness();
    expect(await issue(actor, raw(), { recipients: ["maria@example.com", "pedro@example.com"] })).toMatchObject({ ok: true });
    const queued = await listAllOutboxMessages(db());
    expect(queued).toHaveLength(2);
    expect(JSON.stringify(queued[0]?.payload)).toContain("Maria Santos");

    await fillTestOutbox(actor.organizationId, DOCUMENT_EMAIL_LIMIT.max);
    const before = (await listReceipts(actor, {}, db())).total;
    expect(await issue(actor, raw(), { recipients: ["x@example.com"] })).toMatchObject({ ok: false, error: expect.any(String) });
    expect((await listReceipts(actor, {}, db())).total).toBe(before);
  });

  it("refuses an address that is not an email, or more than five", async () => {
    const actor = await testBusiness();
    expect(await issue(actor, raw(), { recipients: ["nope"] })).toMatchObject({ ok: false, errors: { recipients: expect.any(String) } });
    const many = Array.from({ length: 6 }, (_, i) => `p${i}@example.com`);
    expect(await issue(actor, raw(), { recipients: many })).toMatchObject({ ok: false, errors: { recipients: expect.any(String) } });
  });

  it("escapes a payer name that contains markup in the email", async () => {
    const actor = await testBusiness();
    await issue(actor, raw({ payer: "<b>Maria</b>" }), { recipients: ["maria@example.com"] });
    const [message] = await listAllOutboxMessages(db());
    const html = String((message?.payload as { html?: string }).html);
    expect(html).not.toContain("<b>Maria</b>");
    expect(html).toContain("&lt;b&gt;Maria&lt;/b&gt;");
  });

  it("does not touch invoice balances or the payments list", async () => {
    const actor = await testBusiness();
    const customerId = await testCustomer(actor);
    const invoiceId = await issuedStatement(actor, customerId);
    const before = await getInvoice(actor, invoiceId, db());
    await issued(actor, raw({ customerId }));
    expect(await getInvoice(actor, invoiceId, db())).toEqual(before);
    expect((await listPayments(actor, {}, db())).total).toBe(0);
  });
});

describe("voidReceipt", () => {
  it("voids with a reason, keeps the number, and audits it", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await voidReceipt(actor, receiptId, "Wrong amount", db())).toEqual({ ok: true });
    expect(await getReceipt(actor, receiptId, db())).toMatchObject({ receiptNumber: "REC-000001", voidReason: "Wrong amount", voidedBy: actor.userId });
    expect((await listAllAuditEvents(db())).filter((e) => e.action === "receipt.voided")).toHaveLength(1);
    expect((await issued(actor)).receiptNumber).toBe("REC-000002");
  });

  it("needs a reason, and says plainly when it is already void", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await voidReceipt(actor, receiptId, "  ", db())).toMatchObject({ ok: false, errors: { reason: expect.any(String) } });
    await voidReceipt(actor, receiptId, "Wrong amount", db());
    expect(await voidReceipt(actor, receiptId, "Again", db())).toEqual({ ok: false, error: "This receipt is already void." });
  });

  it("finds nothing for another business's receipt, and changes nothing", async () => {
    const actor = await testBusiness();
    const other = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await voidReceipt(other, receiptId, "Nope", db())).toEqual({ ok: false, notFound: true });
    expect(await voidReceipt(actor, "not-a-uuid", "Nope", db())).toEqual({ ok: false, notFound: true });
    expect((await getReceipt(actor, receiptId, db()))?.voidedAt).toBeNull();
  });
});

describe("emailReceipt", () => {
  it("queues one email per address and audits it", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await emailReceipt(actor, receiptId, ["maria@example.com", "pedro@example.com"], { market }, db())).toEqual({ ok: true, queued: 2 });
    expect(await listAllOutboxMessages(db())).toHaveLength(2);
    expect((await listAllAuditEvents(db())).filter((e) => e.action === "receipt.emailed")).toHaveLength(1);
  });

  it("refuses a void receipt, no addresses, and sending over the limit", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await emailReceipt(actor, receiptId, [], { market }, db())).toMatchObject({ ok: false, errors: { recipients: expect.any(String) } });
    await fillTestOutbox(actor.organizationId, DOCUMENT_EMAIL_LIMIT.max);
    expect(await emailReceipt(actor, receiptId, ["a@example.com"], { market }, db())).toMatchObject({ ok: false, error: expect.any(String) });
    const fresh = await testBusiness();
    const voided = await issued(fresh);
    await voidReceipt(fresh, voided.receiptId, "Mistake", db());
    expect(await emailReceipt(fresh, voided.receiptId, ["a@example.com"], { market }, db())).toMatchObject({ ok: false, error: expect.stringContaining("void") });
  });

  it("finds nothing for another business's receipt", async () => {
    const actor = await testBusiness();
    const other = await testBusiness();
    const { receiptId } = await issued(actor);
    expect(await emailReceipt(other, receiptId, ["a@example.com"], { market }, db())).toEqual({ ok: false, notFound: true });
  });
});

describe("getReceipt and listReceipts", () => {
  it("only show the business's own receipts", async () => {
    const actor = await testBusiness();
    const other = await testBusiness();
    const mine = await issued(actor);
    await issued(other);
    expect(await getReceipt(other, mine.receiptId, db())).toBeNull();
    expect((await listReceipts(actor, {}, db())).receipts.map((r) => r.id)).toEqual([mine.receiptId]);
  });

  it("search by number, payer and purpose, and filter by view", async () => {
    const actor = await testBusiness();
    await issued(actor, raw({ payer: "Maria Santos", purpose: "Fuel" }));
    const second = await issued(actor, raw({ kind: "acknowledgement", payer: "Pedro Reyes", purpose: "Deposit for event" }));
    await voidReceipt(actor, second.receiptId, "Mistake", db());
    const ids = async (query: Parameters<typeof listReceipts>[1]) => (await listReceipts(actor, query, db())).receipts.map((r) => r.receiptNumber);
    expect(await ids({ search: "REC-000002" })).toEqual(["REC-000002"]);
    expect(await ids({ search: "maria" })).toEqual(["REC-000001"]);
    expect(await ids({ search: "deposit" })).toEqual(["REC-000002"]);
    expect(await ids({ view: "collection" })).toEqual(["REC-000001"]);
    expect(await ids({ view: "acknowledgement" })).toEqual(["REC-000002"]);
    expect(await ids({ view: "voided" })).toEqual(["REC-000002"]);
    expect((await listReceipts(actor, {}, db())).receipts.map((r) => r.receiptNumber)).toEqual(["REC-000002", "REC-000001"]);
  });

  it("let a member read but not issue or void when the role lacks the permission", async () => {
    const actor = await testBusiness();
    const { receiptId } = await issued(actor);
    const member = await testMember(actor, "member");
    expect(await getReceipt(member, receiptId, db())).toMatchObject({ id: receiptId });
  });
});
