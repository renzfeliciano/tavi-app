import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createTaxRate } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { editIssuedInvoice, voidAndDuplicateInvoice } from "./corrections";
import { getInvoice, saveInvoiceDraft } from "./invoices";
import { issueInvoice } from "./issuing";
import { saveInvoiceRegistration } from "./registration";

// Qualified buyers' discounts on bills (D19; PH: RR 7-2024 Sec. 6 B.18).

const NOW = new Date("2026-10-08T02:00:00Z");
const market = MARKETS.PH;
const options = { locale: "en-PH", qualifiedDiscounts: market.qualifiedDiscounts };
const SENIOR = { kind: "senior_citizen", idNumber: "OSCA-0042", holderName: "Remedios Santos" };

async function setup() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon", taxRegistration: "vat" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Remedios Santos" }, testDb());
  if (!customer.ok) throw new Error("customer");
  const rate = await createTaxRate(actor, { name: "VAT", rate: "12" }, { locale: "en-PH" }, testDb());
  if (!rate.ok) throw new Error("rate");
  return { actor, customerId: customer.customer.id, vatRateId: rate.taxRate.id };
}

const draftInput = (customerId: string, vatRateId: string, overrides: Record<string, unknown> = {}) => ({
  customerId,
  currency: "PHP",
  issueDate: "2026-10-08",
  dueDate: "2026-10-23",
  notes: "",
  terms: "",
  // ₱1,120.00 VAT-inclusive (PH businesses price with VAT included).
  lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,120", taxRateId: vatRateId }],
  qualifiedDiscount: SENIOR,
  ...overrides,
});

const issue = (actor: OrgActor, id: string) =>
  issueInvoice(actor, id, { sender: { emailVerified: true }, market, appUrl: "https://tavi.example", email: null, now: NOW }, testDb());

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("qualified discounts (D19)", () => {
  it("saves a senior citizen's bill: VAT removed, 20% off the price before VAT, the buyer kept", async () => {
    const { actor, customerId, vatRateId } = await setup();
    const saved = await saveInvoiceDraft(actor, null, draftInput(customerId, vatRateId), options, testDb());
    if (!saved.ok) throw new Error(JSON.stringify(saved));

    const invoice = await getInvoice(actor, saved.invoice.id, testDb());
    expect(invoice).toMatchObject({
      subtotalMinor: 112_000,
      discountTotalMinor: 0,
      taxTotalMinor: 0,
      totalMinor: 80_000,
      qualifiedDiscountMinor: 20_000,
      taxWaivedMinor: 12_000,
      qualifiedDiscount: {
        kind: "senior_citizen",
        label: "Senior citizen",
        idLabel: "OSCA / SC ID No.",
        idNumber: "OSCA-0042",
        holderName: "Remedios Santos",
        rateBps: 2000,
        taxExempt: true,
      },
    });
    expect(invoice?.lines[0]).toMatchObject({ taxMinor: 0, totalMinor: 80_000, qualifiedDiscountMinor: 20_000, taxWaivedMinor: 12_000 });
  });

  it("keeps VAT on the full price for a discount the law doesn't exempt (athletes and coaches)", async () => {
    const { actor, customerId, vatRateId } = await setup();
    const saved = await saveInvoiceDraft(
      actor,
      null,
      draftInput(customerId, vatRateId, { qualifiedDiscount: { kind: "naac", idNumber: "PNSTM-1", holderName: "Ana Cruz" } }),
      options,
      testDb(),
    );
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect(saved.invoice).toMatchObject({ taxTotalMinor: 12_000, totalMinor: 92_000, qualifiedDiscountMinor: 20_000, taxWaivedMinor: 0 });
  });

  it("refuses item discounts alongside it, and any discount where the market has none", async () => {
    const { actor, customerId, vatRateId } = await setup();
    const withLineDiscount = draftInput(customerId, vatRateId, {
      lines: [{ ...blankLine(), description: "Cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,120", discountKind: "percent", discountValue: "5" }],
    });
    expect(await saveInvoiceDraft(actor, null, withLineDiscount, options, testDb())).toEqual({
      ok: false,
      errors: { "qualifiedDiscount.kind": market.qualifiedDiscounts.notWithLineDiscounts },
    });
    expect(await saveInvoiceDraft(actor, null, draftInput(customerId, vatRateId), { locale: "en-PH" }, testDb())).toMatchObject({
      ok: false,
      errors: { "qualifiedDiscount.kind": expect.any(String) },
    });
  });

  it("makes a registered invoice's sale VAT-exempt in its breakdown (B.13, B.18)", async () => {
    const { actor, customerId, vatRateId } = await setup();
    await saveInvoiceRegistration(
      actor,
      { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: "1", seriesEnd: "100", title: "Service Invoice" },
      { market, now: NOW },
      testDb(),
    );
    const saved = await saveInvoiceDraft(actor, null, draftInput(customerId, vatRateId), options, testDb());
    if (!saved.ok) throw new Error("draft");
    expect(await issue(actor, saved.invoice.id)).toMatchObject({ ok: true });
    expect((await getInvoice(actor, saved.invoice.id, testDb()))?.registration?.sales).toEqual({
      kind: "vat",
      vatableMinor: 0,
      vatMinor: 0,
      zeroRatedMinor: 0,
      exemptMinor: 100_000,
      lines: ["exempt"],
    });
  });

  it("can be added to a sent billing statement before payment, and goes with void & duplicate", async () => {
    const { actor, customerId, vatRateId } = await setup();
    const saved = await saveInvoiceDraft(actor, null, draftInput(customerId, vatRateId, { qualifiedDiscount: undefined }), options, testDb());
    if (!saved.ok) throw new Error("draft");
    await issue(actor, saved.invoice.id);
    expect((await getInvoice(actor, saved.invoice.id, testDb()))?.totalMinor).toBe(112_000);

    expect(await editIssuedInvoice(actor, saved.invoice.id, draftInput(customerId, vatRateId), options, testDb(), NOW)).toMatchObject({ ok: true });
    expect(await getInvoice(actor, saved.invoice.id, testDb())).toMatchObject({ totalMinor: 80_000, qualifiedDiscount: { idNumber: "OSCA-0042" } });

    const duplicated = await voidAndDuplicateInvoice(actor, saved.invoice.id, "Wrong ID number", testDb(), NOW);
    if (!duplicated.ok) throw new Error("duplicate");
    expect(await getInvoice(actor, duplicated.duplicateId, testDb())).toMatchObject({
      status: "DRAFT",
      totalMinor: 80_000,
      qualifiedDiscountMinor: 20_000,
      qualifiedDiscount: { kind: "senior_citizen", idNumber: "OSCA-0042" },
      lines: [expect.objectContaining({ qualifiedDiscountMinor: 20_000, taxWaivedMinor: 12_000 })],
    });
  });
});
