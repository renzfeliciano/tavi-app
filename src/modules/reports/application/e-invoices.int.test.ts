import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { createTaxRate } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { issueInvoice, saveInvoiceDraft, saveInvoiceRegistration, voidInvoice } from "@/modules/invoices";
import { recordPayment } from "@/modules/payments";
import { eInvoiceFor, eInvoicesForPeriod } from "./e-invoices";

// E-invoice exports (D19): registered invoices as structured JSON.

const NOW = new Date("2026-10-08T02:00:00Z");
const market = MARKETS.PH;
const issuing = { sender: { emailVerified: true }, market, appUrl: "https://tavi.example", email: null, now: NOW };
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };

async function business({ registered = true, role = "owner" as Role } = {}) {
  const org = await createTestOrganization(testDb(), {
    name: "Santos Aircon",
    legalName: "Santos Aircon Services",
    taxId: "123-456-789-00000",
    taxRegistration: "vat",
    addressLine1: "Unit 5, Bonifacio",
    city: "Taguig",
  });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const owner: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(owner, { displayName: "Juan Dela Cruz", taxId: "987-654-321-00000" }, testDb());
  const vat = await createTaxRate(owner, { name: "VAT", rate: "12" }, { locale: "en-PH" }, testDb());
  if (!customer.ok || !vat.ok) throw new Error("setup");
  if (registered) {
    await saveInvoiceRegistration(
      owner,
      { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: "1", seriesEnd: "500", title: "Service Invoice" },
      { market, now: NOW },
      testDb(),
    );
  }
  let actor = owner;
  if (role !== "owner") {
    const member = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
    await addTestMembership(testDb(), { organizationId: org.id, userId: member.id, role });
    actor = { organizationId: org.id, userId: member.id, role };
  }
  return { owner, actor, customerId: customer.customer.id, vatId: vat.taxRate.id };
}

async function issued(actor: OrgActor, customerId: string, vatId: string, issueDate = "2026-10-05") {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    {
      customerId,
      currency: "PHP",
      issueDate,
      dueDate: "2026-10-31",
      notes: "",
      terms: "",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,120", taxRateId: vatId }],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("draft");
  const sent = await issueInvoice(actor, saved.invoice.id, issuing, testDb());
  if (!sent.ok) throw new Error("issue");
  return saved.invoice.id;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("e-invoice exports (D19)", () => {
  it("exports one registered invoice with the seller, buyer, VAT breakdown and tax withheld", async () => {
    const { owner, customerId, vatId } = await business();
    const id = await issued(owner, customerId, vatId);
    const paid = await recordPayment(
      owner,
      id,
      { amount: "1,100", withheld: "20", paidOn: "2026-10-06", method: "bank_transfer", reference: "", notes: "" },
      { acknowledge: false, market, now: NOW },
      testDb(),
    );
    if (!paid.ok) throw new Error("payment");

    const file = await eInvoiceFor(owner, id, { market, now: NOW }, testDb());
    expect(file).toMatchObject({ format: { birCertified: false }, generatedAt: NOW.toISOString() });
    expect(file?.invoices).toEqual([
      expect.objectContaining({
        invoiceType: "Service Invoice",
        serialNo: "001",
        issueDate: "2026-10-05",
        status: "ISSUED",
        systemRegistration: expect.objectContaining({ permitOrAcknowledgementNo: "0412-123-00045" }),
        seller: expect.objectContaining({ registeredName: "Santos Aircon Services", tradeName: "Santos Aircon", tinStatement: "VAT Reg TIN" }),
        buyer: expect.objectContaining({ name: "Juan Dela Cruz", tin: "987-654-321-00000" }),
        totals: expect.objectContaining({ vatableSales: "1000.00", vatAmount: "120.00", totalAmountDue: "1120.00", withholdingTax: "20.00" }),
      }),
    ]);
  });

  it("exports a period's registered invoices, void ones marked, and nothing else", async () => {
    const { owner, customerId, vatId } = await business();
    const first = await issued(owner, customerId, vatId, "2026-10-02");
    await issued(owner, customerId, vatId, "2026-09-30");
    await voidInvoice(owner, await issued(owner, customerId, vatId, "2026-10-04"), "Wrong customer", testDb());
    await saveInvoiceDraft(
      owner,
      null,
      { customerId, currency: "PHP", issueDate: "2026-10-03", dueDate: "2026-10-31", notes: "", terms: "", lines: [] },
      { locale: "en-PH" },
      testDb(),
    );

    const file = await eInvoicesForPeriod(owner, { period: OCTOBER, market, now: NOW }, testDb());
    expect(file.period).toEqual(OCTOBER);
    expect(file.invoices.map((i) => [i.serialNo, i.issueDate, i.status, i.statusReason])).toEqual([
      ["001", "2026-10-02", "ISSUED", null],
      ["003", "2026-10-04", "VOID", "Wrong customer"],
    ]);
    expect(await eInvoiceFor(owner, first, { market, now: NOW }, testDb())).not.toBeNull();
  });

  it("has nothing for billing statements, drafts or another business's invoices", async () => {
    const unregistered = await business({ registered: false });
    const statement = await issued(unregistered.owner, unregistered.customerId, unregistered.vatId);
    expect(await eInvoiceFor(unregistered.owner, statement, { market, now: NOW }, testDb())).toBeNull();
    expect((await eInvoicesForPeriod(unregistered.owner, { period: OCTOBER, market, now: NOW }, testDb())).invoices).toEqual([]);

    const other = await business();
    const theirs = await issued(other.owner, other.customerId, other.vatId);
    expect(await eInvoiceFor(unregistered.owner, theirs, { market, now: NOW }, testDb())).toBeNull();
    expect(await eInvoiceFor(other.owner, "not-a-uuid", { market, now: NOW }, testDb())).toBeNull();
  });

  it("is for owners and admins only (reports.read)", async () => {
    const { actor } = await business({ role: "member" });
    await expect(eInvoicesForPeriod(actor, { period: OCTOBER, market, now: NOW }, testDb())).rejects.toThrow();
  });
});
