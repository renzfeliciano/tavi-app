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
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { listOrganizationClocks } from "@/modules/organizations";
import { expireQuotesPastValidity, getQuote, saveQuoteDraft, sendQuote } from "@/modules/quotes";
import { markOverdueInvoices } from "./expiry";
import { getInvoice, saveInvoiceDraft } from "./invoices";
import { issueInvoice } from "./issuing";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const send = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };
const line = { ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,000" };

async function business() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!customer.ok) throw new Error("customer");
  return { actor, customerId: customer.customer.id };
}

async function sentQuote(actor: OrgActor, customerId: string, validUntil: string) {
  const saved = await saveQuoteDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate: "2026-10-01", validUntil, notes: "", terms: "", lines: [line] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("quote");
  await sendQuote(actor, saved.quote.id, send, testDb());
  return saved.quote.id;
}

async function sentInvoice(actor: OrgActor, customerId: string, dueDate: string) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate: "2026-10-01", dueDate, notes: "", terms: "", lines: [line] },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("invoice");
  await issueInvoice(actor, saved.invoice.id, send, testDb());
  return saved.invoice.id;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("daily status job", () => {
  it("lists each business with its time zone", async () => {
    const { actor } = await business();
    expect(await listOrganizationClocks(testDb())).toEqual([{ organizationId: actor.organizationId, timezone: "Asia/Manila" }]);
  });

  it("expires sent quotes after their valid-until day, once, audited as the system", async () => {
    const { actor, customerId } = await business();
    const lapsed = await sentQuote(actor, customerId, "2026-10-05");
    const current = await sentQuote(actor, customerId, "2026-10-06");

    expect(await expireQuotesPastValidity(actor.organizationId, "2026-10-06", testDb())).toBe(1);
    expect(await expireQuotesPastValidity(actor.organizationId, "2026-10-06", testDb())).toBe(0);
    expect((await getQuote(actor, lapsed, testDb()))?.status).toBe("EXPIRED");
    expect((await getQuote(actor, current, testDb()))?.status).toBe("SENT");
    expect((await listAllAuditEvents(testDb())).filter((e) => e.action === "quote.expired")).toMatchObject([
      { actorType: "system", entityId: lapsed },
    ]);
  });

  it("marks unpaid invoices overdue after their due day, once, and only in their own business", async () => {
    const { actor, customerId } = await business();
    const late = await sentInvoice(actor, customerId, "2026-10-05");
    const onTime = await sentInvoice(actor, customerId, "2026-10-06");
    const other = await business();
    const otherLate = await sentInvoice(other.actor, other.customerId, "2026-10-05");

    expect(await markOverdueInvoices(actor.organizationId, "2026-10-06", testDb())).toBe(1);
    expect(await markOverdueInvoices(actor.organizationId, "2026-10-06", testDb())).toBe(0);
    expect((await getInvoice(actor, late, testDb()))?.status).toBe("OVERDUE");
    expect((await getInvoice(actor, onTime, testDb()))?.status).toBe("SENT");
    expect((await getInvoice(other.actor, otherLate, testDb()))?.status).toBe("SENT");
    expect((await listAllAuditEvents(testDb())).filter((e) => e.action === "invoice.overdue")).toMatchObject([
      { actorType: "system", entityId: late },
    ]);
  });
});
