import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { MarketProfile, PaymentMethod } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { allocateDocumentNumber } from "@/modules/documents";
import { isPayable, lockInvoiceForPayment, settleInvoice, invoiceTitle } from "@/modules/invoices";
import {
  documentEmailLimitMessage,
  documentEmailsAllowed,
  enqueueEmail,
  paymentAcknowledgementEmail,
} from "@/modules/notifications";
import { getBusinessProfile, getDocumentSettings } from "@/modules/organizations";
import { type CalendarDate, formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { parseAckRecipients } from "../domain/ack-recipients";
import { parseIdempotencyKey } from "../domain/idempotency";
import { parsePaymentInput, type RawPayment } from "../domain/payment-input";
import { paymentProofRows } from "../domain/payment-proof";
import { payments, withholdingCertificatePayments } from "../schema";
import { auditCertificate } from "./certificate-audit";

// Recording and voiding payments (§B.5). Each runs in one transaction with the
// invoice locked first, so two people recording at once can't overpay it; the
// invoice then recomputes its own status from what's settled.

/** Payments per page on the Payments list. */
export const PAYMENT_PAGE_SIZE = 25;

export type Payment = {
  id: string;
  invoiceId: string;
  amountMinor: number;
  withheldMinor: number;
  currency: string;
  paidOn: CalendarDate;
  method: PaymentMethod;
  reference: string | null;
  /** Bank or wallet, as typed. */
  institution: string | null;
  payerName: string | null;
  /** HH:MM, as typed. */
  paidTime: string | null;
  /** The date written on a cheque; may be after paidOn. */
  chequeDate: CalendarDate | null;
  notes: string | null;
  receiptNumber: string;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
};

const columns = {
  id: payments.id,
  invoiceId: payments.invoiceId,
  amountMinor: payments.amountMinor,
  withheldMinor: payments.withheldMinor,
  currency: payments.currency,
  paidOn: payments.paidOn,
  method: payments.method,
  reference: payments.reference,
  institution: payments.institution,
  payerName: payments.payerName,
  paidTime: payments.paidTime,
  chequeDate: payments.chequeDate,
  notes: payments.notes,
  receiptNumber: payments.receiptNumber,
  voidedAt: payments.voidedAt,
  voidReason: payments.voidReason,
  createdAt: payments.createdAt,
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;

function audit(tx: Executor, actor: OrgActor, action: "payment.recorded" | "payment.voided", paymentId: string, metadata: Record<string, unknown>) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "payment",
    entityId: paymentId,
    metadata,
  });
}

/** What's settled on an invoice: active payments plus tax withheld, and the latest payment date. */
async function settledOn(tx: Executor, invoiceId: string) {
  const [row] = await tx
    .select({
      settled: sql<string>`coalesce(sum(${payments.amountMinor} + ${payments.withheldMinor}), 0)`,
      lastPaidOn: sql<string | null>`max(${payments.paidOn})`,
    })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.voidedAt)));
  return { settledMinor: Number(row?.settled ?? 0), lastPaidOn: row?.lastPaidOn ?? null };
}

export type RecordPaymentResult =
  | { ok: true; paymentId: string; receiptNumber: string; status: string; balanceMinor: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

export type RecordPaymentOptions = {
  /** Who gets a payment acknowledgement email (none to record without emailing). */
  recipients: readonly string[];
  /** The business's market: methods, withheld tax and document wording. */
  market: MarketProfile;
  /** This attempt's idempotency key; a repeat with the same key returns the first result. */
  idempotencyKey?: string | null;
  /** The app's public address, where the acknowledgement email loads its logo from. */
  appUrl?: string;
  now?: Date;
};

export async function recordPayment(
  actor: OrgActor,
  invoiceId: string,
  raw: RawPayment,
  { recipients: rawRecipients, market, idempotencyKey: rawKey, appUrl, now = new Date() }: RecordPaymentOptions,
  db: Database = getDb(),
): Promise<RecordPaymentResult> {
  assertCan(actor, "payments.record");
  if (!isUuid(invoiceId)) return { ok: false, notFound: true };
  const idempotencyKey = parseIdempotencyKey(rawKey);
  if (idempotencyKey === false) return { ok: false, error: "That request wasn't valid. Please try again." };
  const parsedRecipients = parseAckRecipients(rawRecipients);
  if (!parsedRecipients.ok) return { ok: false, errors: { recipients: parsedRecipients.error } };
  const recipients = parsedRecipients.emails;
  const [settings, profile] = await Promise.all([getDocumentSettings(actor, db), getBusinessProfile(actor, db)]);
  const today = todayIn(settings.timezone, now);
  // Checked before anything is recorded, so the person can retry without the email (§I).
  if (recipients.length > 0 && !(await documentEmailsAllowed(db, actor.organizationId, now, recipients.length))) {
    return { ok: false, error: documentEmailLimitMessage("Record it without emailing the acknowledgement") };
  }

  return db.transaction(async (tx): Promise<RecordPaymentResult> => {
    const invoice = await lockInvoiceForPayment(tx, actor, invoiceId);
    if (!invoice) return { ok: false, notFound: true };
    // A repeat of an attempt that already went through (the invoice is locked, so this is race-free).
    if (idempotencyKey) {
      const [seen] = await tx
        .select({ id: payments.id, invoiceId: payments.invoiceId, receiptNumber: payments.receiptNumber })
        .from(payments)
        .where(and(eq(payments.organizationId, actor.organizationId), eq(payments.idempotencyKey, idempotencyKey)));
      if (seen) {
        if (seen.invoiceId !== invoice.id) return { ok: false, error: "That request wasn't valid. Please try again." };
        const settled = await settledOn(tx, invoice.id);
        return {
          ok: true,
          paymentId: seen.id,
          receiptNumber: seen.receiptNumber,
          status: invoice.status,
          balanceMinor: invoice.totalMinor - settled.settledMinor,
        };
      }
    }
    if (!isPayable(invoice.status)) {
      return {
        ok: false,
        error:
          invoice.status === "PAID"
            ? "This is already paid in full."
            : "Payments can only be recorded on a sent invoice that isn't void or cancelled.",
      };
    }
    const before = await settledOn(tx, invoice.id);
    const balanceMinor = invoice.totalMinor - before.settledMinor;
    const parsed = parsePaymentInput(raw, {
      currency: invoice.currency,
      locale: settings.locale,
      balanceMinor,
      today,
      allowWithheld: market.taxWithheld !== null,
    });
    if (!parsed.ok) return parsed;
    const input = parsed.payment;

    const { number: receiptNumber } = await allocateDocumentNumber(tx, actor.organizationId, "receipt");
    const [payment] = await tx
      .insert(payments)
      .values({
        organizationId: actor.organizationId,
        invoiceId: invoice.id,
        amountMinor: input.amountMinor,
        withheldMinor: input.withheldMinor,
        currency: invoice.currency,
        paidOn: input.paidOn,
        method: input.method,
        reference: input.reference,
        institution: input.institution,
        payerName: input.payerName,
        paidTime: input.paidTime,
        chequeDate: input.chequeDate,
        notes: input.notes,
        receiptNumber,
        idempotencyKey,
        recordedBy: actor.userId,
      })
      .returning({ id: payments.id });
    if (!payment) throw new Error("Payment insert returned no row");

    const after = await settledOn(tx, invoice.id);
    const status = await settleInvoice(tx, actor, invoice, { ...after, today });
    const remaining = invoice.totalMinor - after.settledMinor;
    await audit(tx, actor, "payment.recorded", payment.id, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      receiptNumber,
      amountMinor: input.amountMinor,
      withheldMinor: input.withheldMinor,
      currency: invoice.currency,
      method: input.method,
      invoiceStatus: status,
      acknowledgementsQueued: recipients.length,
    });

    if (recipients.length > 0) {
      const money = (minor: number) => formatMoney(minor, invoice.currency, { locale: settings.locale });
      for (const to of recipients) {
      await enqueueEmail(
        tx,
        paymentAcknowledgementEmail({
          to,
          businessName: profile.name,
          businessEmail: profile.email,
          receiptTitle: market.documents.receipt.singular,
          receiptNumber,
          documentName: `${invoiceTitle(invoice, market)} ${invoice.number ?? ""}`.trim(),
          received: money(input.amountMinor),
          withheld:
            input.withheldMinor > 0 && market.taxWithheld
              ? { label: market.taxWithheld.label, amount: money(input.withheldMinor) }
              : null,
          paidOn: formatCalendarDate(input.paidOn, settings.locale),
          details: paymentProofRows(
            { method: input.method, reference: input.reference, institution: input.institution, payerName: input.payerName, paidTime: input.paidTime, chequeDate: input.chequeDate },
            market,
            (date) => formatCalendarDate(date, settings.locale),
          ),
          balance: remaining > 0 ? money(remaining) : null,
          // Payment acknowledgements are supplementary documents (RR 7-2024 Sec. 6 B.15, D13).
          notice: market.supplementaryDocumentNotice,
          disclaimer: market.documents.receipt.disclaimer ?? null,
          ...(appUrl ? { appUrl } : {}),
        }),
        { organizationId: actor.organizationId },
      );
      }
    }
    return { ok: true, paymentId: payment.id, receiptNumber, status, balanceMinor: remaining };
  });
}

export type VoidPaymentResult =
  | { ok: true; status: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

export const MAX_REASON = 500;

/** Voids a payment with a reason (never deleted); the invoice's status is recomputed (§B.5). */
export async function voidPayment(
  actor: OrgActor,
  paymentId: string,
  rawReason: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<VoidPaymentResult> {
  assertCan(actor, "payments.void");
  const reason = rawReason.trim();
  if (!reason) return { ok: false, errors: { reason: "Give a reason. It's kept with the record." } };
  if (reason.length > MAX_REASON) return { ok: false, errors: { reason: tooLong(MAX_REASON) } };
  if (!isUuid(paymentId)) return { ok: false, notFound: true };
  const settings = await getDocumentSettings(actor, db);

  return db.transaction(async (tx): Promise<VoidPaymentResult> => {
    const [found] = await tx
      .select({ invoiceId: payments.invoiceId })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.organizationId, actor.organizationId)));
    if (!found) return { ok: false, notFound: true };
    // Same lock order as recording: the invoice, then its payments.
    const invoice = await lockInvoiceForPayment(tx, actor, found.invoiceId);
    if (!invoice) return { ok: false, notFound: true };
    const [payment] = await tx.select(columns).from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!payment) return { ok: false, notFound: true };
    if (payment.voidedAt) return { ok: false, error: "This payment is already void." };

    await tx
      .update(payments)
      .set({ voidedAt: sql`now()`, voidReason: reason, voidedBy: actor.userId })
      .where(eq(payments.id, payment.id));
    // A voided payment can't be on a 2307: it goes back off the certificate, and the log says so.
    const unlinked = await tx
      .delete(withholdingCertificatePayments)
      .where(eq(withholdingCertificatePayments.paymentId, payment.id))
      .returning({ certificateId: withholdingCertificatePayments.certificateId });
    for (const link of unlinked) {
      await auditCertificate(tx, actor, "withholding_certificate.payment_unlinked", link.certificateId, {
        certificateId: link.certificateId,
        paymentId: payment.id,
      });
    }
    const after = await settledOn(tx, invoice.id);
    const status = await settleInvoice(tx, actor, invoice, { ...after, today: todayIn(settings.timezone, now) });
    await audit(tx, actor, "payment.voided", payment.id, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      receiptNumber: payment.receiptNumber,
      amountMinor: payment.amountMinor,
      withheldMinor: payment.withheldMinor,
      reason,
      invoiceStatus: status,
    });
    return { ok: true, status };
  });
}

/** An invoice's payments, oldest first, voided ones included (they stay on the record). */
export async function listInvoicePayments(actor: OrgActor, invoiceId: string, db: Database = getDb()): Promise<Payment[]> {
  assertCan(actor, "payments.read");
  if (!isUuid(invoiceId)) return [];
  return db
    .select(columns)
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.organizationId, actor.organizationId)))
    .orderBy(payments.paidOn, payments.createdAt);
}

/** One payment, for its acknowledgement page. */
export async function getPayment(actor: OrgActor, id: string, db: Database = getDb()): Promise<Payment | null> {
  assertCan(actor, "payments.read");
  if (!isUuid(id)) return null;
  const [row] = await db
    .select(columns)
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.organizationId, actor.organizationId)));
  return row ?? null;
}

export type PaymentList = { payments: Payment[]; page: number; hasMore: boolean; total: number };

/** Every payment the business recorded, newest first. */
export async function listPayments(
  actor: OrgActor,
  { page = 1 }: { page?: number },
  db: Database = getDb(),
): Promise<PaymentList> {
  assertCan(actor, "payments.read");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const ofOrganization = eq(payments.organizationId, actor.organizationId);
  const [rows, [total]] = await Promise.all([
    db
      .select(columns)
      .from(payments)
      .where(ofOrganization)
      .orderBy(desc(payments.paidOn), desc(payments.createdAt))
      .limit(PAYMENT_PAGE_SIZE + 1)
      .offset((safePage - 1) * PAYMENT_PAGE_SIZE),
    db.select({ value: count() }).from(payments).where(ofOrganization),
  ]);
  return {
    payments: rows.slice(0, PAYMENT_PAGE_SIZE),
    page: safePage,
    hasMore: rows.length > PAYMENT_PAGE_SIZE,
    total: total?.value ?? 0,
  };
}

/**
 * An invoice's active payments for the customer's page. Called only after the
 * customer's link has been resolved (the token is the authorization).
 */
export async function listPaymentsForSharedInvoice(
  organizationId: string,
  invoiceId: string,
  db: Database = getDb(),
): Promise<Pick<Payment, "paidOn" | "amountMinor" | "withheldMinor" | "currency" | "method" | "reference" | "institution" | "payerName" | "paidTime" | "chequeDate" | "receiptNumber">[]> {
  return db
    .select({
      paidOn: payments.paidOn,
      amountMinor: payments.amountMinor,
      withheldMinor: payments.withheldMinor,
      currency: payments.currency,
      method: payments.method,
      reference: payments.reference,
      institution: payments.institution,
      payerName: payments.payerName,
      paidTime: payments.paidTime,
      chequeDate: payments.chequeDate,
      receiptNumber: payments.receiptNumber,
    })
    .from(payments)
    .where(and(eq(payments.organizationId, organizationId), eq(payments.invoiceId, invoiceId), isNull(payments.voidedAt)))
    .orderBy(payments.paidOn, payments.createdAt);
}

/** Money received (active payments, not tax withheld) on or after a date, per currency: the money strip (§G.2). */
export async function paymentsReceivedSince(
  actor: OrgActor,
  since: CalendarDate,
  db: Database = getDb(),
): Promise<{ currency: string; receivedMinor: number }[]> {
  assertCan(actor, "payments.read");
  return db
    .select({
      currency: payments.currency,
      receivedMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::bigint`.mapWith(Number),
    })
    .from(payments)
    .where(and(eq(payments.organizationId, actor.organizationId), isNull(payments.voidedAt), gte(payments.paidOn, since)))
    .groupBy(payments.currency)
    .orderBy(payments.currency);
}
