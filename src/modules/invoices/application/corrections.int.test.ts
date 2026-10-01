import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { cancelInvoice, editIssuedInvoice, voidAndDuplicateInvoice, voidInvoice } from "./corrections";
import { getInvoice, listInvoices, saveInvoiceDraft } from "./invoices";
import { getSharedInvoice, issueInvoice } from "./issuing";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const line = (description: string, unitPrice: string) => ({
  ...blankLine(),
  description,
  quantity: "1",
  unitLabel: "unit",
  unitPrice,
});

async function issued(role: Role = "owner") {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon", paymentTermsDays: 15 });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!customer.ok) throw new Error("customer");
  const input = {
    customerId: customer.customer.id,
    currency: "PHP",
    issueDate: "2026-10-01",
    dueDate: "2026-10-16",
    notes: "",
    terms: "",
    lines: [line("Aircon cleaning", "1,500")],
  };
  const saved = await saveInvoiceDraft(actor, null, input, { locale: "en-PH" }, testDb());
  if (!saved.ok) throw new Error("draft");
  const sent = await issueInvoice(
    actor,
    saved.invoice.id,
    { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW },
    testDb(),
  );
  if (!sent.ok) throw new Error("issue");
  return { actor, id: saved.invoice.id, input, token: sent.url.split("/i/")[1] ?? "" };
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("editIssuedInvoice", () => {
  it("saves new lines and dates as the next revision, audits before/after, and the link shows it", async () => {
    const { actor, id, input, token } = await issued();
    const result = await editIssuedInvoice(
      actor,
      id,
      { ...input, dueDate: "2026-10-31", lines: [line("Aircon cleaning", "1,500"), line("Freon", "800")] },
      { locale: "en-PH" },
      testDb(),
      NOW,
    );
    expect(result).toEqual({ ok: true, revision: 2 });

    const invoice = await getInvoice(actor, id, testDb());
    expect(invoice).toMatchObject({ status: "SENT", revision: 2, totalMinor: 230000, dueDate: "2026-10-31", number: "INV-000001" });
    expect(invoice?.editedAt).toBeInstanceOf(Date);
    const event = (await listAllAuditEvents(testDb())).at(-1);
    expect(event).toMatchObject({ action: "invoice.edited", metadata: { fromRevision: 1, toRevision: 2 } });
    expect(event?.metadata).toMatchObject({ before: { totalMinor: 150000 }, after: { totalMinor: 230000 } });
    expect((await getSharedInvoice(token, testDb()))?.invoice.lines).toHaveLength(2);
  });

  it("recomputes the status: moving the due date into the past makes it overdue", async () => {
    const { actor, id, input } = await issued();
    await editIssuedInvoice(actor, id, { ...input, issueDate: "2026-09-01", dueDate: "2026-09-15" }, { locale: "en-PH" }, testDb(), NOW);
    expect((await getInvoice(actor, id, testDb()))?.status).toBe("OVERDUE");
  });

  it("keeps the customer and currency", async () => {
    const { actor, id, input } = await issued();
    const result = await editIssuedInvoice(actor, id, { ...input, customerId: "" }, { locale: "en-PH" }, testDb(), NOW);
    expect(result).toMatchObject({ ok: false, errors: { customerId: expect.stringContaining("can't change once sent") } });
  });

  it("can't edit a voided invoice", async () => {
    const { actor, id, input } = await issued();
    await voidInvoice(actor, id, "Duplicate", testDb());
    expect(await editIssuedInvoice(actor, id, input, { locale: "en-PH" }, testDb(), NOW)).toEqual({
      ok: false,
      error: "Only a sent, unpaid invoice can be edited. Use void & duplicate instead.",
    });
  });
});

describe("void and cancel", () => {
  it("voids with a reason, keeping the number; the customer's link says so", async () => {
    const { actor, id, token } = await issued();
    expect(await voidInvoice(actor, id, "  ", testDb())).toEqual({
      ok: false,
      errors: { reason: "Give a reason. It's kept with the record." },
    });
    expect(await voidInvoice(actor, id, "Wrong customer", testDb())).toEqual({ ok: true });
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ status: "VOID", voidReason: "Wrong customer", number: "INV-000001" });
    expect((await getSharedInvoice(token, testDb()))?.invoice.status).toBe("VOID");
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "invoice.voided", metadata: { reason: "Wrong customer" } });
  });

  it("cancels with a reason, once", async () => {
    const { actor, id } = await issued();
    expect(await cancelInvoice(actor, id, "Job called off", testDb())).toEqual({ ok: true });
    expect(await getInvoice(actor, id, testDb())).toMatchObject({ status: "CANCELLED", cancelReason: "Job called off" });
    expect(await voidInvoice(actor, id, "Again", testDb())).toEqual({
      ok: false,
      error: "Only a sent invoice with no payments can be voided.",
    });
  });

  it("needs the void permission (members can't)", async () => {
    const { id } = await issued();
    const other = await issued("member");
    await expect(voidInvoice(other.actor, id, "x", testDb())).rejects.toThrow();
  });
});

describe("voidAndDuplicateInvoice", () => {
  it("voids the invoice and opens a new draft with the same items, dated today", async () => {
    const { actor, id } = await issued();
    const result = await voidAndDuplicateInvoice(actor, id, "Wrong quantity", testDb(), NOW);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect((await getInvoice(actor, id, testDb()))?.status).toBe("VOID");
    const copy = await getInvoice(actor, result.duplicateId, testDb());
    expect(copy).toMatchObject({ status: "DRAFT", number: null, totalMinor: 150000, issueDate: "2026-10-01", dueDate: "2026-10-16" });
    expect(copy?.lines.map((l) => l.description)).toEqual(["Aircon cleaning"]);
    expect((await listInvoices(actor, {}, testDb())).total).toBe(2);
  });
});
