import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { purchaseOrders } from "../schema";
import {
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
import { createTaxRate } from "@/modules/catalog";
import { blankLine, type RawLine } from "@/modules/documents";
import type { RawPurchaseOrderDraft } from "../domain/purchase-order-draft";
import { createSupplier } from "./suppliers";
import { archiveSupplier } from "./suppliers";
import {
  cancelPurchaseOrder,
  deletePurchaseOrderDraft,
  emailPurchaseOrder,
  getPurchaseOrder,
  issuePurchaseOrder,
  listPurchaseOrders,
  newPurchaseOrderDefaults,
  receivePurchaseOrder,
  savePurchaseOrderDraft,
} from "./purchase-orders";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const OPTIONS = { locale: "en-PH", units: null };
const VERIFIED = { emailVerified: true };

async function actorFor(role: Role = "member", name = "Reyes Aircon"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name, email: "billing@reyes.example" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function supplier(actor: OrgActor, displayName = "Santos Hardware", extra: Record<string, string> = {}) {
  const result = await createSupplier(actor, { displayName, email: "orders@santos.example", city: "Quezon City", ...extra }, testDb());
  if (!result.ok) throw new Error("supplier");
  return result.supplier;
}

const line = (overrides: Partial<RawLine> = {}): RawLine => ({
  ...blankLine(),
  description: "Copper pipe 1/2 in",
  quantity: "20",
  unitLabel: "pc",
  unitPrice: "145.50",
  ...overrides,
});

const draft = (overrides: Partial<RawPurchaseOrderDraft> = {}): RawPurchaseOrderDraft => ({
  supplierId: "",
  currency: "PHP",
  orderDate: "2026-10-01",
  expectedDate: "2026-10-08",
  notes: "",
  terms: "",
  lines: [line()],
  ...overrides,
});

async function save(actor: OrgActor, input: RawPurchaseOrderDraft, id: string | null = null) {
  const result = await savePurchaseOrderDraft(actor, id, input, OPTIONS, testDb());
  if (!result.ok) throw new Error(`save: ${JSON.stringify(result)}`);
  return result.order;
}

async function readyOrder(actor: OrgActor) {
  const s = await supplier(actor);
  return save(actor, draft({ supplierId: s.id }));
}

const issueOptions = (overrides: Partial<Parameters<typeof issuePurchaseOrder>[2]> = {}) => ({
  sender: VERIFIED,
  market: MARKETS.PH,
  appUrl: "https://tavi.example",
  email: null,
  now: NOW,
  ...overrides,
});

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("newPurchaseOrderDefaults", () => {
  it("starts from today in the business's time zone with its currency, tax mode and default tax", async () => {
    const actor = await actorFor();
    const made = await createTaxRate({ ...actor, role: "owner" }, { name: "VAT", rate: "12", makeDefault: true }, OPTIONS, testDb());
    if (!made.ok) throw new Error("tax rate");

    expect(await newPurchaseOrderDefaults(actor, testDb(), NOW)).toEqual({
      currency: "PHP",
      taxMode: "inclusive",
      orderDate: "2026-10-01",
      notes: "",
      terms: "",
      defaultTaxRateId: made.taxRate.id,
    });
  });
});

describe("savePurchaseOrderDraft", () => {
  it("creates a draft with lines and totals from the one calculation, and audits only the creation", async () => {
    const actor = await actorFor();
    const s = await supplier(actor);

    const order = await save(actor, draft({ supplierId: s.id }));
    await save(actor, draft({ supplierId: s.id, notes: "Back door." }), order.id);

    expect(order).toMatchObject({
      status: "DRAFT",
      number: null,
      supplierId: s.id,
      currency: "PHP",
      orderDate: "2026-10-01",
      expectedDate: "2026-10-08",
      subtotalMinor: 291_000,
      totalMinor: 291_000,
    });
    const detail = await getPurchaseOrder(actor, order.id, testDb());
    expect(detail).toMatchObject({ notes: "Back door.", supplier: { id: s.id, displayName: "Santos Hardware", archived: false } });
    expect(detail?.lines).toEqual([
      expect.objectContaining({ position: 0, description: "Copper pipe 1/2 in", quantity: 200_000, unitPriceMinor: 14_550, totalMinor: 291_000 }),
    ]);
    const events = await listAllAuditEvents(testDb());
    expect(events.map((e) => e.action)).toEqual(["supplier.created", "purchase_order.created"]);
  });

  it("saves a bare draft: no supplier, no lines", async () => {
    const actor = await actorFor();
    const order = await save(actor, draft({ lines: [], expectedDate: "" }));
    expect(order).toMatchObject({ supplierId: null, expectedDate: null, totalMinor: 0 });
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const actor = await actorFor();
    const result = await savePurchaseOrderDraft(actor, null, draft({ orderDate: "nope" }), OPTIONS, testDb());
    expect(result).toEqual({ ok: false, errors: { orderDate: "Enter a real date." } });
    expect((await listPurchaseOrders(actor, {}, testDb())).total).toBe(0);
  });

  it("refuses another business's supplier", async () => {
    const mine = await actorFor("member", "Mine");
    const theirs = await actorFor("member", "Theirs");
    const foreign = await supplier(theirs);

    const result = await savePurchaseOrderDraft(mine, null, draft({ supplierId: foreign.id }), OPTIONS, testDb());

    expect(result).toEqual({ ok: false, errors: { supplierId: "Choose a supplier from the list." } });
  });

  it("refuses an archived supplier on a new draft but keeps one a draft already has", async () => {
    const actor = await actorFor();
    const s = await supplier(actor);
    const order = await save(actor, draft({ supplierId: s.id }));
    await archiveSupplier(actor, s.id, testDb());

    const again = await savePurchaseOrderDraft(actor, order.id, draft({ supplierId: s.id, notes: "Still mine." }), OPTIONS, testDb());
    const fresh = await savePurchaseOrderDraft(actor, null, draft({ supplierId: s.id }), OPTIONS, testDb());

    expect(again.ok).toBe(true);
    expect(fresh).toEqual({ ok: false, errors: { supplierId: "Choose a supplier from the list." } });
  });

  it("refuses a tax rate that is not the business's", async () => {
    const mine = await actorFor("member", "Mine");
    const theirs = await actorFor("member", "Theirs");
    const made = await createTaxRate({ ...theirs, role: "owner" }, { name: "VAT", rate: "12" }, OPTIONS, testDb());
    if (!made.ok) throw new Error("tax rate");

    const result = await savePurchaseOrderDraft(mine, null, draft({ lines: [line({ taxRateId: made.taxRate.id })] }), OPTIONS, testDb());

    expect(result).toEqual({ ok: false, errors: { "lines.0.taxRateId": "Choose a tax rate from the list." } });
  });

  it("will not edit an order that is no longer a draft, or one that does not exist", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    expect(await savePurchaseOrderDraft(actor, order.id, draft(), OPTIONS, testDb())).toEqual({ ok: false, notEditable: true, status: "ISSUED" });
    expect(await savePurchaseOrderDraft(actor, "01890000-0000-7000-8000-000000000000", draft(), OPTIONS, testDb())).toEqual({ ok: false, notFound: true });
  });

  it("says when the order is too large to total", async () => {
    const actor = await actorFor();
    const huge = line({ quantity: "9999999999", unitPrice: "9999999999" });
    const result = await savePurchaseOrderDraft(actor, null, draft({ lines: [huge, huge, huge] }), OPTIONS, testDb());
    expect(result).toMatchObject({ ok: false });
  });
});

describe("deletePurchaseOrderDraft", () => {
  it("deletes a draft and audits it", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);

    expect(await deletePurchaseOrderDraft(actor, order.id, testDb())).toEqual({ ok: true });

    expect(await getPurchaseOrder(actor, order.id, testDb())).toBeNull();
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "purchase_order.deleted", entityId: order.id });
  });

  it("refuses an issued order", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    expect(await deletePurchaseOrderDraft(actor, order.id, testDb())).toEqual({
      ok: false,
      error: "Only drafts can be deleted. Cancel an issued order instead.",
    });
  });

  it("cannot reach another business's draft", async () => {
    const mine = await actorFor("member", "Mine");
    const theirs = await actorFor("member", "Theirs");
    const order = await readyOrder(theirs);
    expect(await deletePurchaseOrderDraft(mine, order.id, testDb())).toEqual({ ok: false, notFound: true });
  });
});

describe("issuePurchaseOrder", () => {
  it("numbers the order, snapshots supplier and seller, and audits it", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);

    const result = await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    expect(result).toEqual({ ok: true, number: "PO-000001" });
    const detail = await getPurchaseOrder(actor, order.id, testDb());
    expect(detail).toMatchObject({
      status: "ISSUED",
      number: "PO-000001",
      supplierSnapshot: { displayName: "Santos Hardware", email: "orders@santos.example", taxId: null },
      sellerSnapshot: expect.objectContaining({ name: "Reyes Aircon" }),
    });
    expect(detail?.issuedAt).toBeInstanceOf(Date);
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "purchase_order.issued",
      metadata: { number: "PO-000001", totalMinor: 291_000, currency: "PHP", emailed: false },
    });
  });

  it("numbers each business separately and in order", async () => {
    const a = await actorFor("member", "A");
    const b = await actorFor("member", "B");
    const a1 = await readyOrder(a);
    const a2 = await readyOrder(a);
    const b1 = await readyOrder(b);

    const numbers = [
      await issuePurchaseOrder(a, a1.id, issueOptions(), testDb()),
      await issuePurchaseOrder(a, a2.id, issueOptions(), testDb()),
      await issuePurchaseOrder(b, b1.id, issueOptions(), testDb()),
    ];

    expect(numbers).toEqual([
      { ok: true, number: "PO-000001" },
      { ok: true, number: "PO-000002" },
      { ok: true, number: "PO-000001" },
    ]);
  });

  it("keeps the supplier as it was when issued", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    const detail = await getPurchaseOrder(actor, order.id, testDb());
    expect(detail?.supplierSnapshot?.displayName).toBe("Santos Hardware");
  });

  it("says what is missing and leaves the draft as it was", async () => {
    const actor = await actorFor();
    const bare = await save(actor, draft({ lines: [] }));

    const result = await issuePurchaseOrder(actor, bare.id, issueOptions(), testDb());

    expect(result).toEqual({
      ok: false,
      errors: { supplierId: "Choose a supplier before issuing.", lines: "Add at least one item before issuing." },
    });
    expect((await getPurchaseOrder(actor, bare.id, testDb()))?.status).toBe("DRAFT");
  });

  it("needs a confirmed email address", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    const result = await issuePurchaseOrder(actor, order.id, issueOptions({ sender: { emailVerified: false } }), testDb());
    expect(result).toEqual({ ok: false, error: "Confirm your email address before issuing. We sent you a link when you signed up." });
  });

  it("answers a second issue (another tab) with a message, not a second number", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    const again = await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    expect(again).toEqual({ ok: false, error: "This purchase order was already issued." });
    expect((await getPurchaseOrder(actor, order.id, testDb()))?.number).toBe("PO-000001");
  });

  it("queues the email when asked, with the notice and without an attachment", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);

    const result = await issuePurchaseOrder(
      actor,
      order.id,
      issueOptions({ email: { to: "Orders@Santos.example", message: "Please confirm." } }),
      testDb(),
    );

    expect(result).toMatchObject({ ok: true });
    const outbox = await listAllOutboxMessages(testDb());
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.payload).toMatchObject({
      to: "orders@santos.example",
      subject: "Purchase order PO-000001 from Reyes Aircon",
      replyTo: "billing@reyes.example",
    });
    expect(JSON.stringify(outbox[0]?.payload)).toContain("Please confirm.");
    expect(JSON.stringify(outbox[0]?.payload)).toContain(MARKETS.PH.supplementaryDocumentNotice);
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ metadata: { emailed: true } });
  });

  it("refuses an invalid email address before changing anything", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    const result = await issuePurchaseOrder(actor, order.id, issueOptions({ email: { to: "nope", message: "" } }), testDb());
    expect(result).toEqual({ ok: false, errors: { emailTo: "Enter a valid email address." } });
    expect((await getPurchaseOrder(actor, order.id, testDb()))?.status).toBe("DRAFT");
  });
});

describe("issuePurchaseOrder racing a save", () => {
  it("freezes the supplier the draft has when it is locked, not the one it had when issuing began", async () => {
    const actor = await actorFor();
    const first = await supplier(actor, "Santos Hardware");
    const second = await supplier(actor, "Dela Cruz Supply");
    const order = await save(actor, draft({ supplierId: first.id }));

    // Another tab holds the draft while issuing starts, swaps the supplier, and lets go.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const otherTab = testDb().transaction(async (tx) => {
      await tx.execute(sql`select id from purchase_orders where id = ${order.id} for update`);
      locked();
      await held;
      await tx.update(purchaseOrders).set({ supplierId: second.id }).where(eq(purchaseOrders.id, order.id));
    });
    await lockTaken;
    const issuing = issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await otherTab;

    expect(await issuing).toEqual({ ok: true, number: "PO-000001" });
    expect(await getPurchaseOrder(actor, order.id, testDb())).toMatchObject({
      supplierId: second.id,
      supplierSnapshot: { displayName: "Dela Cruz Supply" },
    });
  });

  it("refuses, instead of failing, when the draft lost its supplier while issuing waited", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const otherTab = testDb().transaction(async (tx) => {
      await tx.execute(sql`select id from purchase_orders where id = ${order.id} for update`);
      locked();
      await held;
      await tx.update(purchaseOrders).set({ supplierId: null }).where(eq(purchaseOrders.id, order.id));
    });
    await lockTaken;
    const issuing = issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await otherTab;

    expect(await issuing).toEqual({ ok: false, errors: { supplierId: "Choose a supplier before issuing." } });
    expect((await getPurchaseOrder(actor, order.id, testDb()))?.status).toBe("DRAFT");
  });
});

describe("emailPurchaseOrder", () => {
  it("emails an issued order and audits it", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    const result = await emailPurchaseOrder(actor, order.id, { to: "sales@santos.example", message: "" }, { market: MARKETS.PH, sender: VERIFIED, now: NOW }, testDb());

    expect(result).toEqual({ ok: true });
    expect(await listAllOutboxMessages(testDb())).toHaveLength(1);
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "purchase_order.emailed", entityId: order.id });
  });

  it("needs the sender's own address confirmed, as issuing does", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    const result = await emailPurchaseOrder(
      actor,
      order.id,
      { to: "sales@santos.example", message: "" },
      { market: MARKETS.PH, sender: { emailVerified: false }, now: NOW },
      testDb(),
    );

    expect(result).toEqual({ ok: false, error: "Confirm your email address before sending. We sent you a link when you signed up." });
    expect(await listAllOutboxMessages(testDb())).toHaveLength(0);
  });

  it("refuses drafts and cancelled orders, and bad addresses", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    const to = { to: "sales@santos.example", message: "" };
    const ctx = { market: MARKETS.PH, sender: VERIFIED, now: NOW };

    expect(await emailPurchaseOrder(actor, order.id, to, ctx, testDb())).toEqual({ ok: false, error: "Issue the purchase order before emailing it." });
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    expect(await emailPurchaseOrder(actor, order.id, { to: "nope", message: "" }, ctx, testDb())).toEqual({
      ok: false,
      errors: { emailTo: "Enter a valid email address." },
    });
    await cancelPurchaseOrder(actor, order.id, "Changed our mind", testDb());
    expect(await emailPurchaseOrder(actor, order.id, to, ctx, testDb())).toEqual({ ok: false, error: "This purchase order was cancelled, so it can't be emailed." });
  });
});

describe("receivePurchaseOrder", () => {
  it("marks an issued order received on a date, and audits it", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    const result = await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-10-05", note: "All there." }, testDb(), new Date("2026-10-06T02:00:00Z"));

    expect(result).toEqual({ ok: true });
    expect(await getPurchaseOrder(actor, order.id, testDb())).toMatchObject({ status: "RECEIVED", receivedDate: "2026-10-05", receiptNote: "All there." });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "purchase_order.received", metadata: { number: "PO-000001", receivedDate: "2026-10-05" } });
  });

  it("refuses a future date, a date before the order, and a draft", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    expect(await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-10-02", note: "" }, testDb(), NOW)).toEqual({
      ok: false,
      error: "Only an issued purchase order can be marked received.",
    });
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    expect(await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-10-20", note: "" }, testDb(), NOW)).toEqual({
      ok: false,
      errors: { receivedDate: "Choose today or an earlier date." },
    });
    expect(await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-09-30", note: "" }, testDb(), NOW)).toEqual({
      ok: false,
      errors: { receivedDate: "Choose a date on or after the order date." },
    });
  });

  it("cannot receive twice or after cancelling", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-10-01", note: "" }, testDb(), NOW);

    const again = await receivePurchaseOrder(actor, order.id, { receivedDate: "2026-10-01", note: "" }, testDb(), NOW);
    const cancel = await cancelPurchaseOrder(actor, order.id, "Oops", testDb());

    expect(again).toMatchObject({ ok: false, error: expect.any(String) });
    expect(cancel).toEqual({ ok: false, error: "Only an issued purchase order can be cancelled." });
  });
});

describe("cancelPurchaseOrder", () => {
  it("cancels an issued order with a reason, keeping its number", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());

    expect(await cancelPurchaseOrder(actor, order.id, "  Supplier out of stock ", testDb())).toEqual({ ok: true });

    expect(await getPurchaseOrder(actor, order.id, testDb())).toMatchObject({ status: "CANCELLED", number: "PO-000001", cancelReason: "Supplier out of stock" });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "purchase_order.cancelled", metadata: { number: "PO-000001", reason: "Supplier out of stock" } });
  });

  it("needs a reason, and a draft cannot be cancelled", async () => {
    const actor = await actorFor();
    const order = await readyOrder(actor);
    expect(await cancelPurchaseOrder(actor, order.id, "x", testDb())).toEqual({ ok: false, error: "Only an issued purchase order can be cancelled." });
    await issuePurchaseOrder(actor, order.id, issueOptions(), testDb());
    expect(await cancelPurchaseOrder(actor, order.id, "   ", testDb())).toEqual({ ok: false, error: "Say why you are cancelling it." });
  });
});

describe("listPurchaseOrders", () => {
  it("lists newest first, searches number and supplier, filters by status, and counts", async () => {
    const actor = await actorFor();
    const santos = await supplier(actor, "Santos Hardware");
    const lim = await supplier(actor, "Lim Electrical");
    const first = await save(actor, draft({ supplierId: santos.id, orderDate: "2026-09-20", expectedDate: "" }));
    const second = await save(actor, draft({ supplierId: lim.id, orderDate: "2026-10-01" }));
    await issuePurchaseOrder(actor, first.id, issueOptions(), testDb());

    const all = await listPurchaseOrders(actor, {}, testDb());
    expect(all.orders.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(all.total).toBe(2);
    expect(all.orders[1]).toMatchObject({ number: "PO-000001", supplierName: "Santos Hardware", status: "ISSUED" });
    expect((await listPurchaseOrders(actor, { search: "lim" }, testDb())).orders.map((o) => o.id)).toEqual([second.id]);
    expect((await listPurchaseOrders(actor, { search: "po-000001" }, testDb())).orders.map((o) => o.id)).toEqual([first.id]);
    expect((await listPurchaseOrders(actor, { status: "DRAFT" }, testDb())).orders.map((o) => o.id)).toEqual([second.id]);
    expect((await listPurchaseOrders(actor, { search: "%" }, testDb())).orders).toEqual([]);
  });

  it("never shows another business's orders", async () => {
    const mine = await actorFor("member", "Mine");
    const theirs = await actorFor("member", "Theirs");
    const order = await readyOrder(theirs);
    expect((await listPurchaseOrders(mine, {}, testDb())).total).toBe(0);
    expect(await getPurchaseOrder(mine, order.id, testDb())).toBeNull();
    expect(await getPurchaseOrder(mine, "not-an-id", testDb())).toBeNull();
  });
});
