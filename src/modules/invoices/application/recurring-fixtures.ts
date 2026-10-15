import { MARKETS } from "@/config/markets";
import {
  addTestMembership,
  createTestOrganization,
  createTestUser,
  testDb,
} from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { createTaxRate } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { saveInvoiceDraft } from "./invoices";
import { issueInvoice } from "./issuing";

// Made-up data for the recurring-schedule tests: one business, one customer, a draft and an issued billing statement.

export const FIXTURE_TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T02:00:00Z"); // 14 Oct in Manila

export async function recurringScene(role: Role = "owner") {
  const org = await createTestOrganization(testDb(), {
    name: "Santos Aircon",
    email: "billing@santos.example",
    paymentInstructions: "GCash 0917 123 4567",
    paymentTermsDays: 15,
  });
  const user = await createTestUser(testDb(), {
    email: `${crypto.randomUUID()}@example.com`,
    emailVerified: true,
  });
  await addTestMembership(testDb(), {
    organizationId: org.id,
    userId: user.id,
    role,
  });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role };
  const customer = await createCustomer(
    actor,
    { displayName: "Juan Dela Cruz", email: "juan@example.com" },
    testDb(),
  );
  if (!customer.ok) throw new Error("customer");
  return { actor, orgId: org.id, customerId: customer.customer.id };
}

export async function fixtureTaxRate(actor: OrgActor, name = "VAT") {
  const rate = await createTaxRate(
    actor,
    { name, rate: "12" },
    { locale: "en-PH" },
    testDb(),
  );
  if (!rate.ok) throw new Error(`tax rate: ${JSON.stringify(rate)}`);
  return rate.taxRate;
}

export const draftInput = (
  customerId: string,
  overrides: Record<string, unknown> = {},
) => ({
  customerId,
  currency: "PHP",
  issueDate: "2026-10-01",
  dueDate: "2026-10-16",
  notes: "Thank you.",
  terms: "",
  lines: [
    {
      ...blankLine(),
      description: "Aircon cleaning",
      quantity: "2",
      unitLabel: "unit",
      unitPrice: "1,500",
    },
    {
      ...blankLine(),
      description: "Monthly checkup",
      quantity: "1",
      unitLabel: "visit",
      unitPrice: "800",
    },
  ],
  ...overrides,
});

export async function draftBill(
  actor: OrgActor,
  customerId: string,
  overrides: Record<string, unknown> = {},
) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    draftInput(customerId, overrides),
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error(`draft: ${JSON.stringify(saved)}`);
  return saved.invoice;
}

export async function issuedBill(
  actor: OrgActor,
  customerId: string,
  overrides: Record<string, unknown> = {},
) {
  const draft = await draftBill(actor, customerId, overrides);
  const issued = await issueInvoice(
    actor,
    draft.id,
    {
      sender: { emailVerified: true },
      market: MARKETS.PH,
      appUrl: "https://tavi.example",
      email: null,
      now: NOW,
    },
    testDb(),
  );
  if (!issued.ok) throw new Error(`issue: ${JSON.stringify(issued)}`);
  return draft.id;
}
