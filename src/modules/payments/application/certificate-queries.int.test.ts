import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { recordCertificate, voidCertificate } from "./certificates";
import {
  getCertificate,
  listCertificates,
  listPendingByCustomer,
  paymentWithholdingStatus,
  pendingPaymentsForCustomer,
  withholdingForPayments,
} from "./certificate-queries";
import {
  FIXTURE_MARKET,
  FIXTURE_NOW,
  issuedStatement,
  rawCertificate,
  testBusiness,
  testCustomer,
  testMember,
  withheldPayment,
} from "./certificate-fixtures";
import { listPayments, voidPayment } from "./payments";

// Made-up data only. Runs on the test branch (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md, section 6).

const db = () => testDb();
const options = { market: FIXTURE_MARKET, now: FIXTURE_NOW };
const NOT_A_PAYMENT = "00000000-0000-4000-8000-000000000000";

/** One customer, one issued billing statement, and payments with 10.00 (or none) withheld. */
async function scene() {
  const actor = await testBusiness();
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const small = { amount: "100", withheld: "10" };
  const early = await withheldPayment(actor, invoiceId, { ...small, paidOn: "2026-07-01" });
  const late = await withheldPayment(actor, invoiceId, { ...small, paidOn: "2026-09-30" });
  const none = await withheldPayment(actor, invoiceId, { amount: "100", withheld: "0", paidOn: "2026-08-15" });
  return { actor, customerId, invoiceId, early, late, none };
}

const record = async (
  actor: Awaited<ReturnType<typeof testBusiness>>,
  customerId: string,
  paymentIds: string[],
  overrides: Parameters<typeof rawCertificate>[2] = {},
) => {
  const result = await recordCertificate(actor, rawCertificate(customerId, paymentIds, overrides), options, db());
  if (!result.ok || !("id" in result)) throw new Error(`certificate: ${JSON.stringify(result)}`);
  return result.id;
};

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("listPendingByCustomer", () => {
  it("groups active, unlinked payments that have tax withheld, per customer and currency", async () => {
    const { actor, customerId, early, late } = await scene();
    const groups = await listPendingByCustomer(actor, db());
    expect(groups).toEqual([
      {
        customerId,
        customerName: "Juan Dela Cruz",
        currency: "PHP",
        paymentCount: 2,
        withheldMinor: 2000,
        oldestPaidOn: "2026-07-01",
      },
    ]);
    expect([early, late]).toHaveLength(2);
  });

  it("ignores linked payments, voided payments and payments without tax withheld", async () => {
    const { actor, customerId, early, late } = await scene();
    await record(actor, customerId, [early], { year: "2026", quarter: "3", lines: [{ atcCode: "WI160", description: "", rate: "2", month1: "500", month2: "", month3: "", taxWithheld: "10" }] });
    const voided = await voidPayment(actor, late, "Entered twice", db(), FIXTURE_NOW);
    expect(voided.ok).toBe(true);
    expect(await listPendingByCustomer(actor, db())).toEqual([]);
  });

  it("does not show another business's payments", async () => {
    await scene();
    const other = await testBusiness("owner", "Reyes Plumbing");
    expect(await listPendingByCustomer(other, db())).toEqual([]);
  });
});

describe("pendingPaymentsForCustomer", () => {
  it("lists the customer's pending payments with their billing statement number, oldest first", async () => {
    const { actor, customerId, early, late } = await scene();
    const found = await pendingPaymentsForCustomer(actor, customerId, {}, db());
    expect(found.map((payment) => payment.paymentId)).toEqual([early, late]);
    expect(found[0]).toMatchObject({ withheldMinor: 1000, currency: "PHP", paidOn: "2026-07-01" });
    expect(found[0]?.invoiceNumber).toBeTruthy();
    expect(found[0]?.receiptNumber).toBeTruthy();
  });

  it("honours the period, both ends included", async () => {
    const { actor, customerId, early, late } = await scene();
    const first = await pendingPaymentsForCustomer(actor, customerId, { period: { from: "2026-07-01", to: "2026-07-01" } }, db());
    expect(first.map((payment) => payment.paymentId)).toEqual([early]);
    const last = await pendingPaymentsForCustomer(actor, customerId, { period: { from: "2026-09-30", to: "2026-09-30" } }, db());
    expect(last.map((payment) => payment.paymentId)).toEqual([late]);
    const outside = await pendingPaymentsForCustomer(actor, customerId, { period: { from: "2026-10-01", to: "2026-12-31" } }, db());
    expect(outside).toEqual([]);
  });

  it("includes the payments already on the certificate being edited, and no other certificate's", async () => {
    const { actor, customerId, early, late } = await scene();
    const certificateId = await record(actor, customerId, [early]);
    expect((await pendingPaymentsForCustomer(actor, customerId, {}, db())).map((payment) => payment.paymentId)).toEqual([late]);
    const editing = await pendingPaymentsForCustomer(actor, customerId, { alsoOnCertificate: certificateId }, db());
    expect(editing.map((payment) => payment.paymentId)).toEqual([early, late]);
  });
});

describe("listCertificates", () => {
  it("returns the newest received first, with totals, ATC codes, link counts and reconciliation", async () => {
    const { actor, customerId, early, late } = await scene();
    const older = await record(actor, customerId, [early], {
      receivedOn: "2026-09-20",
      lines: [{ atcCode: "WI160", description: "", rate: "2", month1: "500", month2: "", month3: "", taxWithheld: "10" }],
    });
    const newer = await record(actor, customerId, [late], {
      receivedOn: "2026-09-28",
      lines: [{ atcCode: "WC160", description: "", rate: "2", month1: "", month2: "", month3: "750", taxWithheld: "15" }],
    });
    const list = await listCertificates(actor, {}, db());
    expect(list.map((item) => item.id)).toEqual([newer, older]);
    expect(list[0]).toMatchObject({
      customerName: "Juan Dela Cruz",
      payorTin: "987-654-321-000",
      periodFrom: "2026-07-01",
      periodTo: "2026-09-30",
      currency: "PHP",
      taxWithheldMinor: 1500,
      atcCodes: ["WC160"],
      linkedCount: 1,
      hasScan: false,
      voidedAt: null,
      reconciliation: { matches: false, differenceMinor: 500 },
    });
    expect(list[1]?.reconciliation).toEqual({ matches: true, differenceMinor: 0 });
  });

  it("filters by year, quarter and customer, and hides void ones unless asked", async () => {
    const { actor, customerId, early } = await scene();
    const current = await record(actor, customerId, [early]);
    const old = await record(actor, customerId, [], { year: "2025", quarter: "4" });
    const otherCustomer = await testCustomer(actor, "Maria Reyes", "555-111-222-000");
    const reyes = await record(actor, otherCustomer, [], { year: "2026", quarter: "2" });

    expect((await listCertificates(actor, { year: 2025 }, db())).map((item) => item.id)).toEqual([old]);
    expect((await listCertificates(actor, { year: 2026, quarter: 3 }, db())).map((item) => item.id)).toEqual([current]);
    expect((await listCertificates(actor, { year: 2026, quarter: 2 }, db())).map((item) => item.id)).toEqual([reyes]);
    expect((await listCertificates(actor, { customerId: otherCustomer }, db())).map((item) => item.id)).toEqual([reyes]);

    expect((await voidCertificate(actor, old, "Wrong payor", db(), FIXTURE_NOW)).ok).toBe(true);
    const visible = (await listCertificates(actor, {}, db())).map((item) => item.id);
    expect(visible).not.toContain(old);
    const voidedOnly = await listCertificates(actor, { voided: true }, db());
    expect(voidedOnly.map((item) => item.id)).toEqual([old]);
    expect(voidedOnly[0]?.voidedAt).toBeInstanceOf(Date);
  });

  it("scopes to the signed-in business", async () => {
    const { actor, customerId } = await scene();
    await record(actor, customerId, []);
    const other = await testBusiness("owner", "Reyes Plumbing");
    expect(await listCertificates(other, {}, db())).toEqual([]);
  });
});

describe("getCertificate", () => {
  it("returns the header, the rows, the linked payments with their billing statement and the reconciliation", async () => {
    const { actor, customerId, invoiceId, early, late } = await scene();
    const id = await record(actor, customerId, [early, late], {
      lines: [{ atcCode: "WI160", description: "Services", rate: "2", month1: "500", month2: "", month3: "500", taxWithheld: "20" }],
    });
    const detail = await getCertificate(actor, id, db());
    expect(detail).toMatchObject({
      id,
      payorName: "Dela Cruz Trading",
      payorAddress: "12 Sampaguita St, Quezon City",
      notes: null,
      voidReason: null,
      fileId: null,
      fileName: null,
      taxWithheldMinor: 2000,
      linkedCount: 2,
      reconciliation: { matches: true, differenceMinor: 0 },
    });
    expect(detail?.lines).toHaveLength(1);
    expect(detail?.lines[0]).toMatchObject({
      position: 1,
      atcCode: "WI160",
      description: "Services",
      rateBps: 200,
      monthMinor: [50000, 0, 50000],
      totalMinor: 100000,
      taxWithheldMinor: 2000,
    });
    expect(detail?.payments.map((payment) => payment.paymentId)).toEqual([early, late]);
    expect(detail?.payments[0]).toMatchObject({ invoiceId, amountMinor: 10000, withheldMinor: 1000, paidOn: "2026-07-01" });
    expect(detail?.payments[0]?.invoiceNumber).toBeTruthy();
  });

  it("shows the difference after a linked payment is voided", async () => {
    const { actor, customerId, early, late } = await scene();
    const id = await record(actor, customerId, [early, late], {
      lines: [{ atcCode: "WI160", description: "", rate: "2", month1: "1,000", month2: "", month3: "", taxWithheld: "20" }],
    });
    expect((await voidPayment(actor, late, "Bounced", db(), FIXTURE_NOW)).ok).toBe(true);
    const detail = await getCertificate(actor, id, db());
    expect(detail?.linkedCount).toBe(1);
    expect(detail?.reconciliation).toEqual({ matches: false, differenceMinor: 1000 });
  });

  it("returns null for another business's certificate, an unknown id and text that is not an id", async () => {
    const { actor, customerId } = await scene();
    const id = await record(actor, customerId, []);
    const other = await testBusiness("owner", "Reyes Plumbing");
    expect(await getCertificate(other, id, db())).toBeNull();
    expect(await getCertificate(actor, NOT_A_PAYMENT, db())).toBeNull();
    expect(await getCertificate(actor, "not-an-id", db())).toBeNull();
  });
});

describe("paymentWithholdingStatus", () => {
  it("is none, pending or received, and leaves out voided payments and unknown ids", async () => {
    const { actor, customerId, invoiceId, early, late, none } = await scene();
    await record(actor, customerId, [early]);
    const voided = await withheldPayment(actor, invoiceId, { amount: "50", withheld: "5", paidOn: "2026-08-01" });
    expect((await voidPayment(actor, voided, "Entered twice", db(), FIXTURE_NOW)).ok).toBe(true);

    const statuses = await paymentWithholdingStatus(actor, [early, late, none, voided, NOT_A_PAYMENT], db());
    expect(statuses.get(early)).toBe("received");
    expect(statuses.get(late)).toBe("pending");
    expect(statuses.get(none)).toBe("none");
    expect(statuses.has(voided)).toBe(false);
    expect(statuses.has(NOT_A_PAYMENT)).toBe(false);
  });

  it("returns an empty map for no ids and never reads another business's payments", async () => {
    const { actor, early } = await scene();
    expect((await paymentWithholdingStatus(actor, [], db())).size).toBe(0);
    const other = await testBusiness("owner", "Reyes Plumbing");
    expect((await paymentWithholdingStatus(other, [early], db())).size).toBe(0);
  });
});

describe("withholdingForPayments", () => {
  it("gives cash received, tax withheld, gross (the two added), status and certificate per payment", async () => {
    const { actor, customerId, early, late, none } = await scene();
    const certificateId = await record(actor, customerId, [early]);
    const found = await withholdingForPayments(actor, [early, late, none], db());
    expect(found.get(early)).toEqual({ amountMinor: 10000, withheldMinor: 1000, grossMinor: 11000, status: "received", certificateId });
    expect(found.get(late)).toEqual({ amountMinor: 10000, withheldMinor: 1000, grossMinor: 11000, status: "pending", certificateId: null });
    expect(found.get(none)).toEqual({ amountMinor: 10000, withheldMinor: 0, grossMinor: 10000, status: "none", certificateId: null });
  });
});

describe("listPayments with the 2307 pending filter", () => {
  it("returns only pending payments, and the totals follow", async () => {
    const { actor, customerId, early, late } = await scene();
    await record(actor, customerId, [early]);

    const all = await listPayments(actor, {}, db());
    expect(all.payments).toHaveLength(3);

    const pending = await listPayments(actor, { withholding: "pending" }, db());
    expect(pending.payments.map((payment) => payment.id)).toEqual([late]);
    expect(pending.total).toBe(3);
    expect(pending.matching).toBe(1);
  });

  it("combines with a search", async () => {
    const { actor, early, late } = await scene();
    const found = await listPayments(actor, { withholding: "pending", search: "Juan" }, db());
    expect(found.payments.map((payment) => payment.id).sort()).toEqual([early, late].sort());
    const missing = await listPayments(actor, { withholding: "pending", search: "nobody-by-this-name" }, db());
    expect(missing.payments).toEqual([]);
  });
});

describe("permissions", () => {
  it("lets a member read every query", async () => {
    const { actor, customerId, early } = await scene();
    const id = await record(actor, customerId, [early]);
    const member = await testMember(actor, "member");
    await expect(listCertificates(member, {}, db())).resolves.toHaveLength(1);
    await expect(getCertificate(member, id, db())).resolves.not.toBeNull();
    await expect(listPendingByCustomer(member, db())).resolves.toBeDefined();
    await expect(pendingPaymentsForCustomer(member, customerId, {}, db())).resolves.toBeDefined();
    await expect(paymentWithholdingStatus(member, [early], db())).resolves.toBeDefined();
    await expect(withholdingForPayments(member, [early], db())).resolves.toBeDefined();
  });
});
