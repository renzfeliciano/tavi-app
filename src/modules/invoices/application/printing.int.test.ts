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
import { getInvoice, saveInvoiceDraft } from "./invoices";
import { issueInvoice } from "./issuing";
import { recordInvoicePrint, recordSharedInvoicePrint } from "./printing";
import { saveInvoiceRegistration } from "./registration";

const NOW = new Date("2026-10-08T02:00:00Z");
const APP_URL = "https://tavi.example";

async function setup({ registered }: { registered: boolean }) {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon", taxRegistration: "vat" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!customer.ok) throw new Error("customer");
  if (registered) {
    const saved = await saveInvoiceRegistration(
      actor,
      { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: "1", seriesEnd: "50", title: "Service Invoice" },
      { market: MARKETS.PH, now: NOW },
      testDb(),
    );
    if (!saved.ok) throw new Error("registration");
  }
  const draft = await saveInvoiceDraft(
    actor,
    null,
    {
      customerId: customer.customer.id,
      currency: "PHP",
      issueDate: "2026-10-08",
      dueDate: "2026-10-23",
      notes: "",
      terms: "",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,500" }],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!draft.ok) throw new Error("draft");
  return { actor, invoiceId: draft.invoice.id };
}

const issue = (actor: OrgActor, id: string) =>
  issueInvoice(actor, id, { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: APP_URL, email: null, now: NOW }, testDb());
const tokenOf = (url: string) => url.split("/i/")[1]!;

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("printing registered invoices (RR 7-2024 Sec. 6 B.21, D19)", () => {
  it("makes the first PDF the original and every later one a reprint, whoever prints it", async () => {
    const { actor, invoiceId } = await setup({ registered: true });
    const issued = await issue(actor, invoiceId);
    if (!issued.ok) throw new Error("issue");

    expect(await recordSharedInvoicePrint(tokenOf(issued.url), testDb())).toEqual({ copy: "original", printNumber: 1 });
    expect(await recordInvoicePrint(actor, invoiceId, testDb())).toEqual({ copy: "reprint", printNumber: 2 });
    expect(await recordInvoicePrint(actor, invoiceId, testDb())).toEqual({ copy: "reprint", printNumber: 3 });
    expect((await getInvoice(actor, invoiceId, testDb()))?.printCount).toBe(3);

    const prints = (await listAllAuditEvents(testDb())).filter((e) => e.action.startsWith("invoice.") && e.action.endsWith("printed"));
    expect(prints.map((e) => [e.action, e.actorType, e.metadata])).toEqual([
      ["invoice.printed", "customer", { number: "01", printNumber: 1 }],
      ["invoice.reprinted", "user", { number: "01", printNumber: 2 }],
      ["invoice.reprinted", "user", { number: "01", printNumber: 3 }],
    ]);
  });

  it("never counts drafts or billing statements", async () => {
    const registered = await setup({ registered: true });
    expect(await recordInvoicePrint(registered.actor, registered.invoiceId, testDb())).toBeNull();

    const statement = await setup({ registered: false });
    await issue(statement.actor, statement.invoiceId);
    expect(await recordInvoicePrint(statement.actor, statement.invoiceId, testDb())).toBeNull();
    expect((await getInvoice(statement.actor, statement.invoiceId, testDb()))?.printCount).toBe(0);
  });

  it("counts concurrent downloads one by one, so only one copy is the original", async () => {
    const { actor, invoiceId } = await setup({ registered: true });
    await issue(actor, invoiceId);
    const prints = await Promise.all(Array.from({ length: 5 }, () => recordInvoicePrint(actor, invoiceId, testDb())));
    expect(prints.filter((p) => p?.copy === "original")).toHaveLength(1);
    expect(prints.map((p) => p?.printNumber).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("can't count another business's invoice or follow a bad link", async () => {
    const { actor, invoiceId } = await setup({ registered: true });
    await issue(actor, invoiceId);
    const other = await setup({ registered: true });
    expect(await recordInvoicePrint(other.actor, invoiceId, testDb())).toBeNull();
    expect(await recordInvoicePrint(other.actor, "not-a-uuid", testDb())).toBeNull();
    expect(await recordSharedInvoicePrint("nope", testDb())).toBeNull();
    expect((await getInvoice(actor, invoiceId, testDb()))?.printCount).toBe(0);
  });
});
