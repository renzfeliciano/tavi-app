import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { BUSINESS_PROFILE_FIELDS, getBusinessProfile, updateBusinessProfile } from "@/modules/organizations";
import { getInvoice, saveInvoiceDraft } from "./invoices";
import { getSharedInvoice, issueInvoice } from "./issuing";

// D25: an issued invoice keeps the business's name, tax ID, registration,
// contact and address as they were when it was sent.

const NOW = new Date("2026-10-08T02:00:00Z");

async function setup() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon", taxRegistration: "vat" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!customer.ok) throw new Error("customer");
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

async function changeProfile(actor: OrgActor, patch: Record<string, string>) {
  const profile = await getBusinessProfile(actor, testDb());
  const values = Object.fromEntries(BUSINESS_PROFILE_FIELDS.map((f) => [f, String(profile[f] ?? "")]));
  const result = await updateBusinessProfile(actor, { ...values, ...patch }, testDb());
  if (!result.ok) throw new Error(`profile: ${JSON.stringify(result)}`);
}

const issue = (actor: OrgActor, id: string) =>
  issueInvoice(actor, id, { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW }, testDb());
const tokenOf = (url: string) => url.split("/i/")[1]!;

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("the seller on an issued invoice", () => {
  it("keeps the business details it was issued with when Settings change later", async () => {
    const { actor, invoiceId } = await setup();
    const issued = await issue(actor, invoiceId);
    if (!issued.ok) throw new Error("issue");
    await changeProfile(actor, { name: "Santos Cooling Co.", city: "Makati", taxId: "999-888-777-00000" });

    const shared = await getSharedInvoice(tokenOf(issued.url), testDb());
    expect(shared?.business).toMatchObject({ name: "Santos Aircon", city: null, taxId: null });
    expect((await getInvoice(actor, invoiceId, testDb()))?.sellerSnapshot).toMatchObject({ name: "Santos Aircon" });
  });

  it("shows the live details on a draft, and the new ones on an invoice issued after the change", async () => {
    const first = await setup();
    await changeProfile(first.actor, { name: "Santos Cooling Co." });
    expect((await getInvoice(first.actor, first.invoiceId, testDb()))?.sellerSnapshot).toBeNull();
    const issued = await issue(first.actor, first.invoiceId);
    if (!issued.ok) throw new Error("issue");
    const shared = await getSharedInvoice(tokenOf(issued.url), testDb());
    expect(shared?.business.name).toBe("Santos Cooling Co.");
  });
});
