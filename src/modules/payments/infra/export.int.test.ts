import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { recordCertificate } from "../application/certificates";
import {
  FIXTURE_MARKET,
  FIXTURE_NOW,
  issuedStatement,
  rawCertificate,
  testBusiness,
  testCustomer,
  withheldPayment,
} from "../application/certificate-fixtures";
import { exportWithholdingCertificates } from "./export";

// Made-up data only. "Download your data" must carry the certificates a business holds (RA 10173 Sec. 18).

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

async function scene(name: string) {
  const actor = await testBusiness("owner", name);
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const paymentId = await withheldPayment(actor, invoiceId, { amount: "100", withheld: "10", paidOn: "2026-07-01" });
  const result = await recordCertificate(actor, rawCertificate(customerId, [paymentId]), { market: FIXTURE_MARKET, now: FIXTURE_NOW }, testDb());
  if (!result.ok || !("id" in result)) throw new Error(`certificate: ${JSON.stringify(result)}`);
  return { actor, paymentId, certificateId: result.id };
}

describe("exportWithholdingCertificates", () => {
  it("lists each certificate with its rows and the payments it covers", async () => {
    const { actor, paymentId, certificateId } = await scene("Santos Aircon");

    const exported = await exportWithholdingCertificates(testDb(), actor.organizationId);

    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({
      id: certificateId,
      payorTin: "987-654-321-000",
      payorName: "Dela Cruz Trading",
      currency: "PHP",
      voidedAt: null,
      paymentIds: [paymentId],
    });
    expect(exported[0]?.lines).toHaveLength(1);
    expect(exported[0]?.lines[0]).toMatchObject({ position: 1, atcCode: "WI160", rateBps: 200 });
  });

  it("includes void certificates, and never another business's", async () => {
    const mine = await scene("Santos Aircon");
    await scene("Reyes Plumbing");

    const exported = await exportWithholdingCertificates(testDb(), mine.actor.organizationId);

    expect(exported.map((c) => c.id)).toEqual([mine.certificateId]);
  });
});
