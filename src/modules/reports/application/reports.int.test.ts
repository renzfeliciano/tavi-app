import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor } from "@/modules/authz";
import { createTaxRate } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { cancelInvoice, issueInvoice, saveInvoiceDraft, voidInvoice } from "@/modules/invoices";
import { recordPayment, voidPayment } from "@/modules/payments";
import { paymentsReport, salesReport, unpaidReport } from "./reports";

const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const TODAY = "2026-10-01";
const Q3 = { from: "2026-07-01", to: "2026-09-30" };
const market = MARKETS.PH;
const issuing = { sender: { emailVerified: true }, market, appUrl: "https://tavi.example", email: null, now: NOW };

async function business(name: string) {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  const vat = await createTaxRate(actor, { name: "VAT", rate: "12" }, { locale: "en-PH" }, testDb());
  if (!customer.ok || !vat.ok) throw new Error("setup");
  return { actor, customerId: customer.customer.id, vatId: vat.taxRate.id };
}

async function bill(
  actor: OrgActor,
  customerId: string,
  { issueDate, price, taxRateId = "", issue = true }: { issueDate: string; price: string; taxRateId?: string; issue?: boolean },
) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    {
      customerId,
      currency: "PHP",
      issueDate,
      dueDate: "2026-10-15",
      notes: "",
      terms: "",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: price, taxRateId }],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("draft");
  if (issue) {
    const issued = await issueInvoice(actor, saved.invoice.id, issuing, testDb());
    if (!issued.ok) throw new Error("issue");
  }
  return saved.invoice.id;
}

async function pay(actor: OrgActor, invoiceId: string, { amount, withheld = "", paidOn }: { amount: string; withheld?: string; paidOn: string }) {
  const paid = await recordPayment(
    actor,
    invoiceId,
    { amount, withheld, paidOn, method: "bank_transfer", reference: "", notes: "" },
    { acknowledge: false, market, now: NOW },
    testDb(),
  );
  if (!paid.ok) throw new Error("payment");
  return paid.paymentId;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("reports", () => {
  it("counts a quarter's bills by issue date: sales and their VAT, cancelled apart, void and drafts left out", async () => {
    const { actor, customerId, vatId } = await business("Santos Aircon");
    await bill(actor, customerId, { issueDate: "2026-09-05", price: "1,120", taxRateId: vatId });
    await cancelInvoice(actor, await bill(actor, customerId, { issueDate: "2026-09-20", price: "500" }), "Job called off", testDb());
    await voidInvoice(actor, await bill(actor, customerId, { issueDate: "2026-09-25", price: "300" }), "Wrong customer", testDb());
    await bill(actor, customerId, { issueDate: "2026-09-10", price: "900", issue: false });
    await bill(actor, customerId, { issueDate: TODAY, price: "700" });

    const { rows, summaries } = await salesReport(actor, { period: Q3, market }, testDb());

    expect(rows.map((r) => [r.issueDate, r.title, r.customerName, r.cancelled])).toEqual([
      ["2026-09-05", "Billing statement", "Juan Dela Cruz", false],
      ["2026-09-20", "Billing statement", "Juan Dela Cruz", true],
    ]);
    expect(summaries).toEqual([
      {
        currency: "PHP",
        issued: { count: 1, totalMinor: 112_000, netMinor: 100_000, taxMinor: 12_000 },
        registered: { count: 0, totalMinor: 0 },
        cancelled: { count: 1, totalMinor: 50_000 },
        breakdown: { vatableMinor: 100_000, vatMinor: 12_000, zeroRatedMinor: 0, exemptMinor: 0, qualifiedDiscountMinor: 0 },
      },
    ]);
  });

  it("totals the period's payments with the tax each customer withheld, leaving out voided ones", async () => {
    const { actor, customerId } = await business("Santos Aircon");
    const paidInFull = await bill(actor, customerId, { issueDate: "2026-09-05", price: "1,000" });
    await pay(actor, paidInFull, { amount: "980", withheld: "20", paidOn: "2026-09-30" });
    const later = await bill(actor, customerId, { issueDate: "2026-09-06", price: "500" });
    const mistake = await pay(actor, later, { amount: "100", paidOn: "2026-09-15" });
    await voidPayment(actor, mistake, "Recorded twice", testDb());
    await pay(actor, later, { amount: "200", paidOn: TODAY });

    const { rows, summaries } = await paymentsReport(actor, { period: Q3 }, testDb());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ paidOn: "2026-09-30", customerName: "Juan Dela Cruz", amountMinor: 98_000, withheldMinor: 2_000 });
    expect(summaries[0]).toMatchObject({
      currency: "PHP",
      count: 1,
      receivedMinor: 98_000,
      withheldMinor: 2_000,
      byMethod: [{ method: "bank_transfer", count: 1, receivedMinor: 98_000 }],
      withheldByCustomer: [{ customerName: "Juan Dela Cruz", customerTaxId: null, count: 1, withheldMinor: 2_000 }],
    });
  });

  it("ages what's owed today, leaving out bills that are paid, cancelled or void", async () => {
    const { actor, customerId } = await business("Santos Aircon");
    await bill(actor, customerId, { issueDate: "2026-09-01", price: "1,000" });
    const paid = await bill(actor, customerId, { issueDate: "2026-09-02", price: "400" });
    await pay(actor, paid, { amount: "400", paidOn: TODAY });
    await cancelInvoice(actor, await bill(actor, customerId, { issueDate: "2026-09-03", price: "250" }), "Called off", testDb());

    const { rows, summaries } = await unpaidReport(actor, { today: "2026-10-20", market }, testDb());

    expect(rows.map((r) => r.totalMinor)).toEqual([100_000]);
    expect(summaries[0]).toMatchObject({ currency: "PHP", outstandingMinor: 100_000, buckets: { "1-30": 100_000 } });
  });

  it("shows a business only its own figures", async () => {
    const mine = await business("Santos Aircon");
    const theirs = await business("Reyes Plumbing");
    const theirBill = await bill(theirs.actor, theirs.customerId, { issueDate: "2026-09-05", price: "5,000" });
    await pay(theirs.actor, theirBill, { amount: "1,000", paidOn: "2026-09-10" });

    expect((await salesReport(mine.actor, { period: Q3, market }, testDb())).rows).toEqual([]);
    expect((await paymentsReport(mine.actor, { period: Q3 }, testDb())).rows).toEqual([]);
    expect((await unpaidReport(mine.actor, { today: TODAY, market }, testDb())).rows).toEqual([]);
  });

  it("is for owners and admins only", async () => {
    const { actor } = await business("Santos Aircon");
    const member: OrgActor = { ...actor, role: "member" };

    await expect(salesReport(member, { period: Q3, market }, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(paymentsReport(member, { period: Q3 }, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(unpaidReport(member, { today: TODAY, market }, testDb())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
