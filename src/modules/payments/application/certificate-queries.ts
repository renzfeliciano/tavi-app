import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { customers, files, invoices } from "@/db/schema";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import {
  type CertificateLineInput,
  type Quarter,
  quarterBounds,
  reconcile,
  type WithholdingStatus,
  withholdingStatus,
} from "../domain/withholding";
import { payments, withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "../schema";

// Reading withholding certificates (PH: BIR Form 2307) and the payments still
// waiting for one. Everything needs `payments.read`, which all three roles have.
// "Waiting" is derived: a payment that is active, has tax withheld and is on no
// certificate (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md, sections 3 and 6).

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: OrgActor) => eq(withholdingCertificates.organizationId, actor.organizationId);

export type CertificateSummary = {
  id: string;
  customerId: string;
  customerName: string;
  payorTin: string;
  payorName: string;
  periodFrom: CalendarDate;
  periodTo: CalendarDate;
  receivedOn: CalendarDate;
  currency: string;
  /** What the form says was withheld: its rows added. */
  taxWithheldMinor: number;
  atcCodes: string[];
  linkedCount: number;
  hasScan: boolean;
  /** The form's total minus the linked payments' tax withheld. */
  reconciliation: { matches: boolean; differenceMinor: number };
  voidedAt: Date | null;
};

export type CertificateLine = CertificateLineInput & { id: string };

export type LinkedPayment = {
  paymentId: string;
  receiptNumber: string;
  paidOn: CalendarDate;
  invoiceId: string;
  invoiceNumber: string | null;
  amountMinor: number;
  withheldMinor: number;
};

export type CertificateDetail = CertificateSummary & {
  payorAddress: string | null;
  notes: string | null;
  voidReason: string | null;
  fileId: string | null;
  fileName: string | null;
  lines: CertificateLine[];
  payments: LinkedPayment[];
};

export type CertificateFilter = { year?: number; quarter?: Quarter; customerId?: string; voided?: boolean };

const headerColumns = {
  id: withholdingCertificates.id,
  customerId: withholdingCertificates.customerId,
  customerName: customers.displayName,
  payorTin: withholdingCertificates.payorTin,
  payorName: withholdingCertificates.payorName,
  payorAddress: withholdingCertificates.payorAddress,
  periodFrom: withholdingCertificates.periodFrom,
  periodTo: withholdingCertificates.periodTo,
  receivedOn: withholdingCertificates.receivedOn,
  currency: withholdingCertificates.currency,
  fileId: withholdingCertificates.fileId,
  notes: withholdingCertificates.notes,
  voidReason: withholdingCertificates.voidReason,
  voidedAt: withholdingCertificates.voidedAt,
};

type HeaderRow = {
  id: string;
  customerId: string;
  customerName: string;
  payorTin: string;
  payorName: string;
  payorAddress: string | null;
  periodFrom: CalendarDate;
  periodTo: CalendarDate;
  receivedOn: CalendarDate;
  currency: string;
  fileId: string | null;
  notes: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
};

async function withTotals(db: Database, headers: readonly HeaderRow[]): Promise<(CertificateSummary & HeaderRow)[]> {
  if (headers.length === 0) return [];
  const ids = headers.map((header) => header.id);
  const [lineRows, linkRows] = await Promise.all([
    db
      .select({
        certificateId: withholdingCertificateLines.certificateId,
        atcCode: withholdingCertificateLines.atcCode,
        taxWithheldMinor: withholdingCertificateLines.taxWithheldMinor,
      })
      .from(withholdingCertificateLines)
      .where(inArray(withholdingCertificateLines.certificateId, ids))
      .orderBy(asc(withholdingCertificateLines.position)),
    db
      .select({
        certificateId: withholdingCertificatePayments.certificateId,
        linkedCount: count(),
        linkedTax: sql<string>`coalesce(sum(${payments.withheldMinor}), 0)`,
      })
      .from(withholdingCertificatePayments)
      .innerJoin(
        payments,
        and(
          eq(payments.organizationId, withholdingCertificatePayments.organizationId),
          eq(payments.id, withholdingCertificatePayments.paymentId),
        ),
      )
      .where(inArray(withholdingCertificatePayments.certificateId, ids))
      .groupBy(withholdingCertificatePayments.certificateId),
  ]);
  const taxOf = new Map<string, number>();
  const codesOf = new Map<string, string[]>();
  for (const line of lineRows) {
    taxOf.set(line.certificateId, (taxOf.get(line.certificateId) ?? 0) + line.taxWithheldMinor);
    const codes = codesOf.get(line.certificateId) ?? [];
    if (!codes.includes(line.atcCode)) codes.push(line.atcCode);
    codesOf.set(line.certificateId, codes);
  }
  const linked = new Map(linkRows.map((row) => [row.certificateId, { count: row.linkedCount, tax: Number(row.linkedTax) }]));
  return headers.map((header) => {
    const taxWithheldMinor = taxOf.get(header.id) ?? 0;
    const link = linked.get(header.id) ?? { count: 0, tax: 0 };
    return {
      ...header,
      taxWithheldMinor,
      atcCodes: codesOf.get(header.id) ?? [],
      linkedCount: link.count,
      hasScan: header.fileId !== null,
      reconciliation: reconcile(taxWithheldMinor, link.tax),
    };
  });
}

function toSummary(row: CertificateSummary): CertificateSummary {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    payorTin: row.payorTin,
    payorName: row.payorName,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    receivedOn: row.receivedOn,
    currency: row.currency,
    taxWithheldMinor: row.taxWithheldMinor,
    atcCodes: row.atcCodes,
    linkedCount: row.linkedCount,
    hasScan: row.hasScan,
    reconciliation: row.reconciliation,
    voidedAt: row.voidedAt,
  };
}

/** Certificates, newest received first. Void ones are hidden unless `voided: true`, which shows only them. */
export async function listCertificates(actor: OrgActor, filter: CertificateFilter = {}, db: Database = getDb()): Promise<CertificateSummary[]> {
  assertCan(actor, "payments.read");
  if (filter.customerId !== undefined && !isUuid(filter.customerId)) return [];
  const { year, quarter } = filter;
  const period =
    year !== undefined && quarter !== undefined
      ? (() => {
          const bounds = quarterBounds(year, quarter);
          return and(gte(withholdingCertificates.periodFrom, bounds.from), lte(withholdingCertificates.periodFrom, bounds.to));
        })()
      : year !== undefined
        ? and(gte(withholdingCertificates.periodFrom, `${year}-01-01`), lte(withholdingCertificates.periodFrom, `${year}-12-31`))
        : quarter !== undefined
          ? sql`extract(quarter from ${withholdingCertificates.periodFrom}::timestamp) = ${quarter}`
          : undefined;
  const headers = await db
    .select(headerColumns)
    .from(withholdingCertificates)
    .innerJoin(
      customers,
      and(eq(customers.organizationId, withholdingCertificates.organizationId), eq(customers.id, withholdingCertificates.customerId)),
    )
    .where(
      and(
        ofOrganization(actor),
        filter.voided ? sql`${withholdingCertificates.voidedAt} is not null` : isNull(withholdingCertificates.voidedAt),
        filter.customerId ? eq(withholdingCertificates.customerId, filter.customerId) : undefined,
        period,
      ),
    )
    .orderBy(desc(withholdingCertificates.receivedOn), desc(withholdingCertificates.createdAt), desc(withholdingCertificates.id));
  return (await withTotals(db, headers)).map(toSummary);
}

/** One certificate with its rows and the payments it covers; null when it isn't this business's. */
export async function getCertificate(actor: OrgActor, id: string, db: Database = getDb()): Promise<CertificateDetail | null> {
  assertCan(actor, "payments.read");
  if (!isUuid(id)) return null;
  const headers = await db
    .select(headerColumns)
    .from(withholdingCertificates)
    .innerJoin(
      customers,
      and(eq(customers.organizationId, withholdingCertificates.organizationId), eq(customers.id, withholdingCertificates.customerId)),
    )
    .where(and(ofOrganization(actor), eq(withholdingCertificates.id, id)));
  const [summary] = await withTotals(db, headers);
  if (!summary) return null;

  const [lineRows, linked, [file]] = await Promise.all([
    db
      .select()
      .from(withholdingCertificateLines)
      .where(eq(withholdingCertificateLines.certificateId, id))
      .orderBy(asc(withholdingCertificateLines.position)),
    db
      .select({
        paymentId: payments.id,
        receiptNumber: payments.receiptNumber,
        paidOn: payments.paidOn,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.number,
        amountMinor: payments.amountMinor,
        withheldMinor: payments.withheldMinor,
      })
      .from(withholdingCertificatePayments)
      .innerJoin(
        payments,
        and(
          eq(payments.organizationId, withholdingCertificatePayments.organizationId),
          eq(payments.id, withholdingCertificatePayments.paymentId),
        ),
      )
      .innerJoin(invoices, and(eq(invoices.organizationId, payments.organizationId), eq(invoices.id, payments.invoiceId)))
      .where(eq(withholdingCertificatePayments.certificateId, id))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt), asc(payments.id)),
    summary.fileId
      ? db.select({ fileName: files.fileName }).from(files).where(and(eq(files.id, summary.fileId), eq(files.organizationId, actor.organizationId)))
      : Promise.resolve([] as { fileName: string | null }[]),
  ]);
  return {
    ...summary,
    fileName: file?.fileName ?? null,
    lines: lineRows.map((line) => ({
      id: line.id,
      position: line.position,
      atcCode: line.atcCode,
      description: line.description,
      rateBps: line.rateBps,
      monthMinor: [line.month1Minor, line.month2Minor, line.month3Minor],
      totalMinor: line.totalMinor,
      taxWithheldMinor: line.taxWithheldMinor,
    })),
    payments: linked,
  };
}

export type PendingGroup = {
  customerId: string;
  customerName: string;
  currency: string;
  paymentCount: number;
  withheldMinor: number;
  oldestPaidOn: CalendarDate;
};

/**
 * Payments with tax withheld and no certificate yet: active, and on no 2307. For queries that left-join
 * `withholdingCertificatePayments` on the payment (also used by the quarterly report).
 */
export const waiting = (actor: OrgActor) =>
  and(
    eq(payments.organizationId, actor.organizationId),
    isNull(payments.voidedAt),
    sql`${payments.withheldMinor} > 0`,
    isNull(withholdingCertificatePayments.paymentId),
  );

/** What each customer still owes a 2307 for: how many payments, how much tax, and since when. */
export async function listPendingByCustomer(actor: OrgActor, db: Database = getDb()): Promise<PendingGroup[]> {
  assertCan(actor, "payments.read");
  const rows = await db
    .select({
      customerId: customers.id,
      customerName: customers.displayName,
      currency: payments.currency,
      paymentCount: count(),
      withheldMinor: sql<string>`sum(${payments.withheldMinor})`,
      oldestPaidOn: sql<CalendarDate>`min(${payments.paidOn})`,
    })
    .from(payments)
    .leftJoin(withholdingCertificatePayments, eq(withholdingCertificatePayments.paymentId, payments.id))
    .innerJoin(invoices, and(eq(invoices.organizationId, payments.organizationId), eq(invoices.id, payments.invoiceId)))
    .innerJoin(customers, and(eq(customers.organizationId, invoices.organizationId), eq(customers.id, invoices.customerId)))
    .where(waiting(actor))
    .groupBy(customers.id, customers.displayName, payments.currency)
    .orderBy(sql`min(${payments.paidOn})`, customers.displayName, payments.currency);
  return rows.map((row) => ({ ...row, withheldMinor: Number(row.withheldMinor) }));
}

export type PendingPayment = {
  paymentId: string;
  receiptNumber: string;
  paidOn: CalendarDate;
  invoiceId: string;
  invoiceNumber: string | null;
  withheldMinor: number;
  currency: string;
};

/**
 * One customer's payments waiting for a 2307, oldest first, optionally only those paid in a period (both ends
 * included). `alsoOnCertificate` adds the payments already on that certificate, for editing it.
 */
export async function pendingPaymentsForCustomer(
  actor: OrgActor,
  customerId: string,
  { period, alsoOnCertificate }: { period?: { from: CalendarDate; to: CalendarDate }; alsoOnCertificate?: string } = {},
  db: Database = getDb(),
): Promise<PendingPayment[]> {
  assertCan(actor, "payments.read");
  if (!isUuid(customerId)) return [];
  const own = alsoOnCertificate && isUuid(alsoOnCertificate) ? alsoOnCertificate : null;
  return db
    .select({
      paymentId: payments.id,
      receiptNumber: payments.receiptNumber,
      paidOn: payments.paidOn,
      invoiceId: payments.invoiceId,
      invoiceNumber: invoices.number,
      withheldMinor: payments.withheldMinor,
      currency: payments.currency,
    })
    .from(payments)
    .leftJoin(withholdingCertificatePayments, eq(withholdingCertificatePayments.paymentId, payments.id))
    .innerJoin(invoices, and(eq(invoices.organizationId, payments.organizationId), eq(invoices.id, payments.invoiceId)))
    .where(
      and(
        eq(payments.organizationId, actor.organizationId),
        eq(invoices.customerId, customerId),
        isNull(payments.voidedAt),
        sql`${payments.withheldMinor} > 0`,
        own
          ? sql`(${withholdingCertificatePayments.paymentId} is null or ${withholdingCertificatePayments.certificateId} = ${own})`
          : isNull(withholdingCertificatePayments.paymentId),
        period ? gte(payments.paidOn, period.from) : undefined,
        period ? lte(payments.paidOn, period.to) : undefined,
      ),
    )
    .orderBy(asc(payments.paidOn), asc(payments.createdAt), asc(payments.id));
}

/** Each payment's 2307 status. Voided payments, other businesses' payments and unknown ids are left out. */
export async function paymentWithholdingStatus(
  actor: OrgActor,
  paymentIds: readonly string[],
  db: Database = getDb(),
): Promise<Map<string, WithholdingStatus>> {
  const found = await withholdingForPayments(actor, paymentIds, db);
  return new Map([...found].map(([id, row]) => [id, row.status]));
}

export type PaymentWithholding = {
  /** Cash received. */
  amountMinor: number;
  withheldMinor: number;
  /** What the customer settled in all: cash plus tax withheld. */
  grossMinor: number;
  status: WithholdingStatus;
  certificateId: string | null;
};

/** Cash received, tax withheld, gross and 2307 status per payment: what the Cash Receipts Journal (Phase 5B) needs. */
export async function withholdingForPayments(
  actor: OrgActor,
  paymentIds: readonly string[],
  db: Database = getDb(),
): Promise<Map<string, PaymentWithholding>> {
  assertCan(actor, "payments.read");
  const ids = [...new Set(paymentIds.filter(isUuid))];
  const result = new Map<string, PaymentWithholding>();
  if (ids.length === 0) return result;
  const rows = await db
    .select({
      id: payments.id,
      amountMinor: payments.amountMinor,
      withheldMinor: payments.withheldMinor,
      certificateId: withholdingCertificatePayments.certificateId,
    })
    .from(payments)
    .leftJoin(withholdingCertificatePayments, eq(withholdingCertificatePayments.paymentId, payments.id))
    .where(and(eq(payments.organizationId, actor.organizationId), isNull(payments.voidedAt), inArray(payments.id, ids)));
  for (const row of rows) {
    result.set(row.id, {
      amountMinor: row.amountMinor,
      withheldMinor: row.withheldMinor,
      grossMinor: row.amountMinor + row.withheldMinor,
      status: withholdingStatus(row.withheldMinor, row.certificateId !== null),
      certificateId: row.certificateId,
    });
  }
  return result;
}
