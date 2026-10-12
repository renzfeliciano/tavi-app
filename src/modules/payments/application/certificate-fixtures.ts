import { MARKETS } from "@/config/markets";
import { addTestMembership, createTestOrganization, createTestUser, testDb } from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { issueInvoice, saveInvoiceDraft } from "@/modules/invoices";
import type { RawCertificate } from "../domain/withholding";
import { recordPayment } from "./payments";

// Made-up businesses, customers, billing statements and payments for the
// withholding-certificate integration tests. Test code only; no real TINs or names.

/** 1 Oct 2026 in Manila: after the 3rd quarter, so a Q3 certificate can already be in hand. */
export const FIXTURE_NOW = new Date("2026-10-01T02:00:00Z");
export const FIXTURE_TODAY = "2026-10-01";
export const FIXTURE_MARKET = MARKETS.PH;

export async function testBusiness(role: Role = "owner", organizationName = "Santos Aircon"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name: organizationName, email: "billing@santos.example" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  return { organizationId: org.id, userId: user.id, role };
}

/** Another member of the same business, in another role. */
export async function testMember(actor: OrgActor, role: Role): Promise<OrgActor> {
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: actor.organizationId, userId: user.id, role });
  return { organizationId: actor.organizationId, userId: user.id, role };
}

export async function testCustomer(actor: OrgActor, displayName = "Juan Dela Cruz", taxId = "123-456-789-000"): Promise<string> {
  const customer = await createCustomer(actor, { displayName, email: "juan@example.com", taxId }, testDb());
  if (!customer.ok) throw new Error("customer");
  return customer.customer.id;
}

/** An issued billing statement of 3,000.00 (2 × 1,500.00), due 16 Oct 2026. */
export async function issuedStatement(actor: OrgActor, customerId: string): Promise<string> {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    {
      customerId,
      currency: "PHP",
      issueDate: "2026-09-01",
      dueDate: "2026-10-16",
      notes: "",
      terms: "",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("draft");
  const sent = await issueInvoice(
    actor,
    saved.invoice.id,
    { sender: { emailVerified: true }, market: FIXTURE_MARKET, appUrl: "https://tavi.example", email: null, now: FIXTURE_NOW },
    testDb(),
  );
  if (!sent.ok) throw new Error("issue");
  return saved.invoice.id;
}

/** Records a payment of 900.00 with 60.00 withheld (defaults), dated in the 3rd quarter; returns its id. */
export async function withheldPayment(
  actor: OrgActor,
  invoiceId: string,
  overrides: { amount?: string; withheld?: string; paidOn?: string } = {},
): Promise<string> {
  const result = await recordPayment(
    actor,
    invoiceId,
    {
      amount: overrides.amount ?? "900",
      withheld: overrides.withheld ?? "60",
      paidOn: overrides.paidOn ?? "2026-09-15",
      method: "bank_transfer",
      reference: "REF-1",
      institution: "",
      payer: "",
      paidTime: "",
      chequeDate: "",
      notes: "",
    },
    { recipients: [], market: FIXTURE_MARKET, now: FIXTURE_NOW },
    testDb(),
  );
  if (!result.ok) throw new Error(`payment: ${JSON.stringify(result)}`);
  return result.paymentId;
}

/** A valid certificate for the 3rd quarter of 2026: income 3,000.00 at 2% is 60.00 withheld. */
export function rawCertificate(customerId: string, paymentIds: string[], overrides: Partial<RawCertificate> = {}): RawCertificate {
  return {
    customerId,
    payorTin: "987-654-321-000",
    payorName: "Dela Cruz Trading",
    payorAddress: "12 Sampaguita St, Quezon City",
    year: "2026",
    quarter: "3",
    receivedOn: FIXTURE_TODAY,
    notes: "",
    lines: [{ atcCode: "WI160", description: "Services", rate: "2", month1: "", month2: "3,000", month3: "", taxWithheld: "60" }],
    paymentIds,
    ...overrides,
  };
}
