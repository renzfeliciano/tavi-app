import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { customers, invoices } from "@/db/schema";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import { type Quarter, quarterBounds } from "../domain/withholding";
import { payments, withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "../schema";
import { waiting } from "./certificate-queries";

// Creditable tax withheld, by quarter and payor (PH: the 2307 certificates a
// business holds), for the accountant. Received and still-waiting figures are
// kept apart: what is waiting is never added into what was received
// (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md, section 8).

export type WithholdingCsvRow = {
  status: "Received" | "Pending";
  payorTin: string;
  payorName: string;
  receivedOn: CalendarDate | null;
  atcCode: string | null;
  rateBps: number | null;
  monthMinor: [number, number, number] | null;
  totalMinor: number | null;
  taxWithheldMinor: number;
  /** The billing statements the payments are on, as numbers. */
  billingStatements: string;
  hasScan: boolean | null;
  currency: string;
};

export type WithholdingReport = {
  year: number;
  quarter: Quarter;
  received: {
    payorTin: string;
    payorName: string;
    currency: string;
    taxWithheldMinor: number;
    lines: { atcCode: string; rateBps: number; incomeMinor: number; taxWithheldMinor: number; certificateCount: number }[];
  }[];
  waiting: { customerId: string; customerName: string; currency: string; paymentCount: number; withheldMinor: number }[];
  totals: { currency: string; incomeMinor: number; taxWithheldMinor: number }[];
  rows: WithholdingCsvRow[];
};

/** A TIN's digits, so "987-654-321-000" and "987 654 321 000" are the same payor. */
const tinDigits = (tin: string) => tin.replaceAll(/\D/g, "");

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The quarter's certificates (the calendar quarter of the period's first day; void ones excluded) grouped by
 * payor and ATC, the payments in the quarter still waiting for a certificate, and the rows for the CSV.
 */
export async function withholdingReport(
  actor: OrgActor,
  { year, quarter }: { year: number; quarter: Quarter },
  db: Database = getDb(),
): Promise<WithholdingReport> {
  assertCan(actor, "payments.read");
  const { from, to } = quarterBounds(year, quarter);

  const [lineRows, pendingRows] = await Promise.all([
    db
      .select({
        certificateId: withholdingCertificates.id,
        payorTin: withholdingCertificates.payorTin,
        payorName: withholdingCertificates.payorName,
        receivedOn: withholdingCertificates.receivedOn,
        currency: withholdingCertificates.currency,
        fileId: withholdingCertificates.fileId,
        position: withholdingCertificateLines.position,
        atcCode: withholdingCertificateLines.atcCode,
        rateBps: withholdingCertificateLines.rateBps,
        month1Minor: withholdingCertificateLines.month1Minor,
        month2Minor: withholdingCertificateLines.month2Minor,
        month3Minor: withholdingCertificateLines.month3Minor,
        totalMinor: withholdingCertificateLines.totalMinor,
        taxWithheldMinor: withholdingCertificateLines.taxWithheldMinor,
      })
      .from(withholdingCertificateLines)
      .innerJoin(
        withholdingCertificates,
        and(
          eq(withholdingCertificates.organizationId, withholdingCertificateLines.organizationId),
          eq(withholdingCertificates.id, withholdingCertificateLines.certificateId),
        ),
      )
      .where(
        and(
          eq(withholdingCertificates.organizationId, actor.organizationId),
          isNull(withholdingCertificates.voidedAt),
          gte(withholdingCertificates.periodFrom, from),
          lte(withholdingCertificates.periodFrom, to),
        ),
      )
      .orderBy(
        asc(withholdingCertificates.receivedOn),
        asc(withholdingCertificates.createdAt),
        asc(withholdingCertificates.id),
        asc(withholdingCertificateLines.position),
      ),
    db
      .select({
        paymentId: payments.id,
        paidOn: payments.paidOn,
        currency: payments.currency,
        withheldMinor: payments.withheldMinor,
        invoiceNumber: invoices.number,
        customerId: customers.id,
        customerName: customers.displayName,
        customerTaxId: customers.taxId,
      })
      .from(payments)
      .leftJoin(withholdingCertificatePayments, eq(withholdingCertificatePayments.paymentId, payments.id))
      .innerJoin(invoices, and(eq(invoices.organizationId, payments.organizationId), eq(invoices.id, payments.invoiceId)))
      .innerJoin(customers, and(eq(customers.organizationId, invoices.organizationId), eq(customers.id, invoices.customerId)))
      .where(and(waiting(actor), gte(payments.paidOn, from), lte(payments.paidOn, to)))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt), asc(payments.id)),
  ]);

  // The billing statements each certificate's payments are on.
  const certificateIds = [...new Set(lineRows.map((row) => row.certificateId))];
  const statementsOf = new Map<string, string>();
  if (certificateIds.length > 0) {
    const links = await db
      .select({ certificateId: withholdingCertificatePayments.certificateId, number: invoices.number })
      .from(withholdingCertificatePayments)
      .innerJoin(
        payments,
        and(
          eq(payments.organizationId, withholdingCertificatePayments.organizationId),
          eq(payments.id, withholdingCertificatePayments.paymentId),
        ),
      )
      .innerJoin(invoices, and(eq(invoices.organizationId, payments.organizationId), eq(invoices.id, payments.invoiceId)))
      .where(inArray(withholdingCertificatePayments.certificateId, certificateIds));
    const numbers = new Map<string, Set<string>>();
    for (const link of links) {
      if (!link.number) continue;
      numbers.set(link.certificateId, (numbers.get(link.certificateId) ?? new Set()).add(link.number));
    }
    for (const [id, set] of numbers) statementsOf.set(id, [...set].sort(byText).join("; "));
  }

  // Payors by TIN digits and currency; rows are in received order, so the last one seen is the latest.
  type Payor = WithholdingReport["received"][number] & { atc: Map<string, WithholdingReport["received"][number]["lines"][number] & { ids: Set<string> }> };
  const payors = new Map<string, Payor>();
  const totals = new Map<string, { currency: string; incomeMinor: number; taxWithheldMinor: number }>();
  for (const row of lineRows) {
    const key = `${tinDigits(row.payorTin)}|${row.currency}`;
    const payor = payors.get(key) ?? { payorTin: row.payorTin, payorName: row.payorName, currency: row.currency, taxWithheldMinor: 0, lines: [], atc: new Map() };
    payor.payorTin = row.payorTin;
    payor.payorName = row.payorName;
    payor.taxWithheldMinor += row.taxWithheldMinor;
    const atcKey = `${row.atcCode}|${row.rateBps}`;
    const atc = payor.atc.get(atcKey) ?? { atcCode: row.atcCode, rateBps: row.rateBps, incomeMinor: 0, taxWithheldMinor: 0, certificateCount: 0, ids: new Set<string>() };
    atc.incomeMinor += row.totalMinor;
    atc.taxWithheldMinor += row.taxWithheldMinor;
    atc.ids.add(row.certificateId);
    atc.certificateCount = atc.ids.size;
    payor.atc.set(atcKey, atc);
    payors.set(key, payor);

    const total = totals.get(row.currency) ?? { currency: row.currency, incomeMinor: 0, taxWithheldMinor: 0 };
    total.incomeMinor += row.totalMinor;
    total.taxWithheldMinor += row.taxWithheldMinor;
    totals.set(row.currency, total);
  }
  const received = [...payors.values()]
    .map(({ atc, ...payor }) => ({
      ...payor,
      lines: [...atc.values()]
        .map((line) => ({
          atcCode: line.atcCode,
          rateBps: line.rateBps,
          incomeMinor: line.incomeMinor,
          taxWithheldMinor: line.taxWithheldMinor,
          certificateCount: line.certificateCount,
        }))
        .sort((a, b) => byText(a.atcCode, b.atcCode) || a.rateBps - b.rateBps),
    }))
    .sort((a, b) => byText(a.payorName, b.payorName) || byText(tinDigits(a.payorTin), tinDigits(b.payorTin)) || byText(a.currency, b.currency));

  const customersWaiting = new Map<string, WithholdingReport["waiting"][number]>();
  for (const row of pendingRows) {
    const key = `${row.customerId}|${row.currency}`;
    const group = customersWaiting.get(key) ?? { customerId: row.customerId, customerName: row.customerName, currency: row.currency, paymentCount: 0, withheldMinor: 0 };
    group.paymentCount += 1;
    group.withheldMinor += row.withheldMinor;
    customersWaiting.set(key, group);
  }

  const rows: WithholdingCsvRow[] = [
    ...lineRows.map((row): WithholdingCsvRow => ({
      status: "Received",
      payorTin: row.payorTin,
      payorName: row.payorName,
      receivedOn: row.receivedOn,
      atcCode: row.atcCode,
      rateBps: row.rateBps,
      monthMinor: [row.month1Minor, row.month2Minor, row.month3Minor],
      totalMinor: row.totalMinor,
      taxWithheldMinor: row.taxWithheldMinor,
      billingStatements: statementsOf.get(row.certificateId) ?? "",
      hasScan: row.fileId !== null,
      currency: row.currency,
    })),
    ...pendingRows.map((row): WithholdingCsvRow => ({
      status: "Pending",
      payorTin: row.customerTaxId ?? "",
      payorName: row.customerName,
      receivedOn: null,
      atcCode: null,
      rateBps: null,
      monthMinor: null,
      totalMinor: null,
      taxWithheldMinor: row.withheldMinor,
      billingStatements: row.invoiceNumber ?? "",
      hasScan: null,
      currency: row.currency,
    })),
  ];

  return {
    year,
    quarter,
    received,
    waiting: [...customersWaiting.values()].sort((a, b) => byText(a.customerName, b.customerName) || byText(a.currency, b.currency)),
    totals: [...totals.values()].sort((a, b) => byText(a.currency, b.currency)),
    rows,
  };
}
