import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { MARKETS } from "@/config/markets";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { createSchedule, issueInvoice, saveInvoiceDraft } from "@/modules/invoices";
import { saveQuestionnaire } from "@/modules/organizations";
import { issueReceipt, voidReceipt } from "@/modules/payments";
import { createSupplier, issuePurchaseOrder, savePurchaseOrderDraft } from "@/modules/purchasing";
import { putInTrash } from "@/modules/trash";
import { exportBusinessData } from "./export";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

async function actorFor(role: Role = "owner", name = "Acme") {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, name: "Maria Santos" });
  return { organizationId: org.id, userId: user.id, role, timezone: org.timezone } satisfies OrgActor & { timezone: string };
}

describe("exportBusinessData", () => {
  it("writes the business, the person's account and only this business's records", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    await createCustomer(actor, { displayName: "Juan Dela Cruz" }, db);
    await createCustomer(other, { displayName: "Not mine" }, db);

    const now = new Date("2026-10-02T03:00:00Z");
    const result = await exportBusinessData(actor, db, now);
    if (!result.ok) throw new Error("export refused");

    expect(result.fileName).toBe("tavi-export-2026-10-02.json");
    const data = JSON.parse(result.body);
    expect(data).toMatchObject({
      format: "tavi-export",
      version: 1,
      exportedAt: "2026-10-02T03:00:00.000Z",
      account: { name: "Maria Santos" },
      business: { id: actor.organizationId, name: "Acme" },
      quotes: [],
      invoices: [],
      payments: [],
      withholdingCertificates: [],
    });
    expect(data.customers.map((c: { displayName: string }) => c.displayName)).toEqual(["Juan Dela Cruz"]);
    expect(JSON.stringify(data)).not.toContain("Not mine");
    expect(data.account).not.toHaveProperty("password");

    const exported = (await listAllAuditEvents()).filter((e) => e.action === "organization.exported");
    expect(exported).toMatchObject([{ organizationId: actor.organizationId, actorId: actor.userId }]);
  });

  it("includes what is waiting in the recycle bin, and only this business's", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    const now = new Date("2026-10-02T03:00:00Z");
    const draft = { kind: "sent_quote" as const, label: "QUO-000007", originalId: crypto.randomUUID(), customerName: "Juan Dela Cruz", totalMinor: 150_000, currency: "PHP", payload: { v: 1, lines: [] } };
    await db.transaction(async (tx) => {
      await putInTrash(tx, actor, draft, now);
      await putInTrash(tx, other, { ...draft, originalId: crypto.randomUUID(), customerName: "Not mine" }, now);
    });

    const result = await exportBusinessData(actor, db, now);
    if (!result.ok) throw new Error("export refused");
    const data = JSON.parse(result.body);
    expect(data.recycleBin).toMatchObject([{ kind: "sent_quote", label: "QUO-000007", customerName: "Juan Dela Cruz", totalMinor: 150000, originalId: draft.originalId }]);
    expect(JSON.stringify(data)).not.toContain("Not mine");
  });

  it("includes recurring schedules with their items, and only this business's", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    async function repeating(who: typeof actor, customerName: string) {
      const customer = await createCustomer(who, { displayName: customerName }, db);
      if (!customer.ok) throw new Error("customer");
      const line = (description: string, unitPrice: string) => ({ ...blankLine(), description, quantity: "1", unitLabel: "unit", unitPrice });
      const draft = await saveInvoiceDraft(
        who,
        null,
        { customerId: customer.customer.id, currency: "PHP", issueDate: "2026-10-01", dueDate: "2026-10-16", notes: "", terms: "", lines: [line("Aircon cleaning", "3,000"), line("Monthly checkup", "800")] },
        { locale: "en-PH" },
        db,
      );
      if (!draft.ok) throw new Error("draft");
      const issued = await issueInvoice(
        who,
        draft.invoice.id,
        { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: new Date("2026-10-14T02:00:00Z") },
        db,
      );
      if (!issued.ok) throw new Error("issue");
      const made = await createSchedule(who, draft.invoice.id, { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01" }, { today: "2026-10-14" }, db);
      if (!made.ok) throw new Error("schedule");
      return made.id;
    }
    const mine = await repeating(actor, "Juan Dela Cruz");
    await repeating(other, "Not mine");

    const result = await exportBusinessData(actor, db, new Date("2026-10-14T03:00:00Z"));
    if (!result.ok) throw new Error("export refused");
    const data = JSON.parse(result.body);
    expect(data.recurringSchedules).toHaveLength(1);
    expect(data.recurringSchedules[0]).toMatchObject({ id: mine, frequency: "monthly", anchorDay: 1, nextRunOn: "2026-11-01", status: "active" });
    expect(data.recurringSchedules[0].lines.map((l: { description: string; unitPriceMinor: number }) => [l.description, l.unitPriceMinor])).toEqual([
      ["Aircon cleaning", 300_000],
      ["Monthly checkup", 80_000],
    ]);
    expect(data.notes.recurringSchedules).toEqual(expect.stringContaining("recurringSchedules"));
    expect(JSON.stringify(data)).not.toContain("Not mine");
  });

  it("includes receipts, void ones too, and only this business's", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    const input = (payer: string) => ({ customerId: "", kind: "collection", payer, amount: "1,500", receivedOn: "2026-10-01", method: "cash", reference: "", institution: "", paidTime: "", chequeDate: "", purpose: "Reimbursement of fuel", notes: "" });
    const now = new Date("2026-10-02T03:00:00Z");
    const first = await issueReceipt(actor, input("Maria Santos"), { recipients: [], market: MARKETS.PH, now }, db);
    const second = await issueReceipt(actor, input("Pedro Reyes"), { recipients: [], market: MARKETS.PH, now }, db);
    await issueReceipt(other, input("Not mine"), { recipients: [], market: MARKETS.PH, now }, db);
    if (!first.ok || !second.ok) throw new Error("receipt");
    await voidReceipt(actor, second.receiptId, "Wrong amount", db);

    const result = await exportBusinessData(actor, db, now);
    if (!result.ok) throw new Error("export refused");
    const data = JSON.parse(result.body);
    expect(data.receipts.map((r: { receiptNumber: string; payerName: string; amountMinor: number; voidReason: string | null }) => [r.receiptNumber, r.payerName, r.amountMinor, r.voidReason])).toEqual([
      ["REC-000001", "Maria Santos", 150_000, null],
      ["REC-000002", "Pedro Reyes", 150_000, "Wrong amount"],
    ]);
    expect(data.receipts[0]).not.toHaveProperty("idempotencyKey");
    expect(data.notes.receipts).toEqual(expect.stringContaining("receipts"));
    expect(JSON.stringify(data)).not.toContain("Not mine");
  });

  it("includes suppliers (archived too) and purchase orders with their lines, only this business's", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    const made = await createSupplier(actor, { displayName: "Santos Hardware", contactName: "Rosa Reyes" }, db);
    await createSupplier(other, { displayName: "Not mine" }, db);
    if (!made.ok) throw new Error("supplier");
    const saved = await savePurchaseOrderDraft(
      actor,
      null,
      { supplierId: made.supplier.id, currency: "PHP", orderDate: "2026-10-01", expectedDate: "", notes: "", terms: "", lines: [{ ...blankLine(), description: "Copper pipe", quantity: "2", unitLabel: "pc", unitPrice: "100" }] },
      { locale: "en-PH" },
      db,
    );
    if (!saved.ok) throw new Error("order");
    const now = new Date("2026-10-02T03:00:00Z");
    await issuePurchaseOrder(actor, saved.order.id, { sender: { emailVerified: true }, market: MARKETS.PH, email: null, now }, db);

    const result = await exportBusinessData(actor, db, now);
    if (!result.ok) throw new Error("export refused");
    const data = JSON.parse(result.body);
    expect(data.suppliers.map((x: { displayName: string; contactName: string }) => [x.displayName, x.contactName])).toEqual([["Santos Hardware", "Rosa Reyes"]]);
    expect(data.purchaseOrders).toHaveLength(1);
    expect(data.purchaseOrders[0]).toMatchObject({ number: "PO-000001", status: "ISSUED", totalMinor: 20_000 });
    expect(data.purchaseOrders[0].lines.map((l: { description: string }) => l.description)).toEqual(["Copper pipe"]);
    expect(data.notes.suppliers).toEqual(expect.stringContaining("suppliers"));
    expect(data.notes.purchaseOrders).toEqual(expect.stringContaining("purchaseOrders"));
    expect(JSON.stringify(data)).not.toContain("Not mine");
  });

  it("includes the RDO/CPA worksheet, only this business's", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    await saveQuestionnaire(actor, { facts: { salesBand: "under_3m" }, questions: { withholding: { note: "Bring the 2307s", answer: "", answeredOn: "" } } }, db);
    await saveQuestionnaire(other, { facts: {}, questions: { withholding: { note: "Not mine", answer: "", answeredOn: "" } } }, db);

    const result = await exportBusinessData(actor, db, new Date("2026-10-02T03:00:00Z"));
    if (!result.ok) throw new Error("export refused");
    const data = JSON.parse(result.body);
    expect(data.rdoCpaWorksheet).toMatchObject({
      facts: { salesBand: "under_3m" },
      questions: { withholding: { note: "Bring the 2307s", answer: null, answeredOn: null } },
    });
    expect(data.notes.rdoCpaWorksheet).toEqual(expect.stringContaining("rdoCpaWorksheet"));
    expect(JSON.stringify(data)).not.toContain("Not mine");
  });

  it("is for owners and admins only", async () => {
    const actor = await actorFor("member");
    await expect(exportBusinessData(actor, testDb())).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("limits how often one person can download", async () => {
    const db = testDb();
    const actor = await actorFor();
    const now = new Date("2026-10-02T03:00:00Z");
    for (let i = 0; i < 5; i++) expect((await exportBusinessData(actor, db, now)).ok).toBe(true);
    expect(await exportBusinessData(actor, db, now)).toMatchObject({ ok: false, error: "rate_limited" });
  });
});
