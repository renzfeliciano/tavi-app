import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { getCertificate } from "./certificate-queries";
import { recordCertificate, voidCertificate } from "./certificates";
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
import { withholdingReport } from "./withholding-report";

// Made-up data only. Runs on the test branch (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md, section 8).

const db = () => testDb();
const options = { market: FIXTURE_MARKET, now: FIXTURE_NOW };

const line = (atcCode: string, rate: string, amounts: [string, string, string], taxWithheld: string) => ({
  atcCode,
  description: "",
  rate,
  month1: amounts[0],
  month2: amounts[1],
  month3: amounts[2],
  taxWithheld,
});

async function scene() {
  const actor = await testBusiness();
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const small = { amount: "100", withheld: "10" };
  const early = await withheldPayment(actor, invoiceId, { ...small, paidOn: "2026-07-01" });
  const late = await withheldPayment(actor, invoiceId, { ...small, paidOn: "2026-09-30" });
  const extra = await withheldPayment(actor, invoiceId, { amount: "100", withheld: "5", paidOn: "2026-08-20" });
  return { actor, customerId, invoiceId, early, late, extra };
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

describe("withholdingReport", () => {
  it("groups two certificates from one payor by TIN digits, then by ATC, with the name from the latest", async () => {
    const { actor, customerId, early, late } = await scene();
    await record(actor, customerId, [early], {
      payorTin: "987-654-321-000",
      payorName: "Dela Cruz Trading",
      receivedOn: "2026-09-20",
      lines: [line("WI160", "2", ["500", "", ""], "10")],
    });
    await record(actor, customerId, [late], {
      payorTin: "987 654 321 000",
      payorName: "Dela Cruz Trading Inc.",
      receivedOn: "2026-09-28",
      lines: [line("WI160", "2", ["", "", "750"], "15"), line("WC160", "1", ["", "", "400"], "4")],
    });

    const report = await withholdingReport(actor, { year: 2026, quarter: 3 }, db());
    expect(report.year).toBe(2026);
    expect(report.quarter).toBe(3);
    expect(report.received).toEqual([
      {
        payorTin: "987 654 321 000",
        payorName: "Dela Cruz Trading Inc.",
        currency: "PHP",
        taxWithheldMinor: 2900,
        lines: [
          { atcCode: "WC160", rateBps: 100, incomeMinor: 40000, taxWithheldMinor: 400, certificateCount: 1 },
          { atcCode: "WI160", rateBps: 200, incomeMinor: 125000, taxWithheldMinor: 2500, certificateCount: 2 },
        ],
      },
    ]);
    expect(report.totals).toEqual([{ currency: "PHP", incomeMinor: 165000, taxWithheldMinor: 2900 }]);
  });

  it("leaves out void certificates and certificates of another quarter", async () => {
    const { actor, customerId, early } = await scene();
    await record(actor, customerId, [early]);
    const wrong = await record(actor, customerId, [], { payorTin: "111-222-333-000", payorName: "Wrong Payor" });
    expect((await voidCertificate(actor, wrong, "Wrong payor", db(), FIXTURE_NOW)).ok).toBe(true);
    await record(actor, customerId, [], { year: "2026", quarter: "4", payorTin: "444-555-666-000", payorName: "Q4 Payor" });
    await record(actor, customerId, [], { year: "2025", quarter: "3", payorTin: "777-888-999-000", payorName: "Last Year Payor" });

    const q3 = await withholdingReport(actor, { year: 2026, quarter: 3 }, db());
    expect(q3.received.map((payor) => payor.payorName)).toEqual(["Dela Cruz Trading"]);
    const q4 = await withholdingReport(actor, { year: 2026, quarter: 4 }, db());
    expect(q4.received.map((payor) => payor.payorName)).toEqual(["Q4 Payor"]);
    const previousYear = await withholdingReport(actor, { year: 2025, quarter: 3 }, db());
    expect(previousYear.received.map((payor) => payor.payorName)).toEqual(["Last Year Payor"]);
  });

  it("keeps the payments still waiting for a 2307 apart from what was received", async () => {
    const { actor, customerId, early, late, extra } = await scene();
    await record(actor, customerId, [early, late]);
    const report = await withholdingReport(actor, { year: 2026, quarter: 3 }, db());
    expect(report.waiting).toEqual([
      { customerId, customerName: "Juan Dela Cruz", currency: "PHP", paymentCount: 1, withheldMinor: 500 },
    ]);
    // Never added into the received totals.
    expect(report.totals).toEqual([{ currency: "PHP", incomeMinor: 300000, taxWithheldMinor: 6000 }]);
    expect(extra).toBeTruthy();
    // A quarter with no payments has nothing waiting.
    const quiet = await withholdingReport(actor, { year: 2026, quarter: 2 }, db());
    expect(quiet.waiting).toEqual([]);
    expect(quiet.received).toEqual([]);
    expect(quiet.totals).toEqual([]);
    expect(quiet.rows).toEqual([]);
  });

  it("counts a payment dated on the first or last day of the quarter in that quarter only", async () => {
    const { actor } = await scene();
    const q3 = await withholdingReport(actor, { year: 2026, quarter: 3 }, db());
    // 1 Jul, 20 Aug and 30 Sep are all in Q3.
    expect(q3.waiting[0]?.paymentCount).toBe(3);
    expect((await withholdingReport(actor, { year: 2026, quarter: 4 }, db())).waiting).toEqual([]);
  });

  it("lists one row per certificate row, then one per payment still waiting", async () => {
    const { actor, customerId, early, late, extra } = await scene();
    const first = await record(actor, customerId, [early], {
      receivedOn: "2026-09-20",
      lines: [line("WI160", "2", ["500", "", ""], "10")],
    });
    await record(actor, customerId, [late], {
      receivedOn: "2026-09-28",
      lines: [line("WI160", "2", ["", "", "750"], "15"), line("WC160", "1", ["", "", "400"], "4")],
    });

    const { rows } = await withholdingReport(actor, { year: 2026, quarter: 3 }, db());
    expect(rows).toHaveLength(4);
    const detail = await getCertificate(actor, first, db());
    const statement = detail?.payments[0]?.invoiceNumber ?? "";
    expect(statement).not.toBe("");
    expect(rows[0]).toEqual({
      status: "Received",
      payorTin: "987-654-321-000",
      payorName: "Dela Cruz Trading",
      receivedOn: "2026-09-20",
      atcCode: "WI160",
      rateBps: 200,
      monthMinor: [50000, 0, 0],
      totalMinor: 50000,
      taxWithheldMinor: 1000,
      billingStatements: statement,
      hasScan: false,
      currency: "PHP",
    });
    expect(rows[1]).toMatchObject({ status: "Received", receivedOn: "2026-09-28", atcCode: "WI160", monthMinor: [0, 0, 75000] });
    expect(rows[2]).toMatchObject({ status: "Received", receivedOn: "2026-09-28", atcCode: "WC160", rateBps: 100 });
    expect(rows[3]).toEqual({
      status: "Pending",
      payorTin: "123-456-789-000",
      payorName: "Juan Dela Cruz",
      receivedOn: null,
      atcCode: null,
      rateBps: null,
      monthMinor: null,
      totalMinor: null,
      taxWithheldMinor: 500,
      billingStatements: statement,
      hasScan: null,
      currency: "PHP",
    });
    expect(extra).toBeTruthy();
  });

  it("scopes to the signed-in business and lets a member read it", async () => {
    const { actor, customerId, early } = await scene();
    await record(actor, customerId, [early]);
    const other = await testBusiness("owner", "Reyes Plumbing");
    const empty = await withholdingReport(other, { year: 2026, quarter: 3 }, db());
    expect(empty.received).toEqual([]);
    expect(empty.waiting).toEqual([]);
    const member = await testMember(actor, "member");
    const seen = await withholdingReport(member, { year: 2026, quarter: 3 }, db());
    expect(seen.received).toHaveLength(1);
  });
});
