import { and, count, desc, eq, gte, ilike, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { MarketProfile, PaymentMethod } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { allocateDocumentNumber } from "@/modules/documents";
import {
  findInvoiceIds,
  getInvoiceLabels,
  invoiceTitle,
  isPayable,
  lockInvoiceForPayment,
  settleInvoice,
} from "@/modules/invoices";
import {
  documentEmailLimitMessage,
  emailLimitReached,
  enqueueEmail,
  paymentAcknowledgementEmail,
} from "@/modules/notifications";
import { getBusinessProfile, getDocumentSettings } from "@/modules/organizations";
import { type CalendarDate, formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { type PageMeta, pageMeta, pageWindow } from "@/shared/pagination/page-window";
import { escapeLikePattern } from "@/shared/text/search";
import { tooLong } from "@/shared/validation/messages";
import { putInTrash, takeFromTrash } from "@/modules/trash";
import { parseAckRecipients } from "../domain/ack-recipients";
import { parseIdempotencyKey } from "../domain/idempotency";
import { parsePaymentInput, type RawPayment } from "../domain/payment-input";
import { paymentProofRows } from "../domain/payment-proof";
import { parsePaymentTrashPayload, paymentTrashPayload } from "../domain/trash-payload";
import { payments, withholdingCertificatePayments } from "../schema";
import { auditCertificate } from "./certificate-audit";

// Recording and voiding payments (§B.5). Each runs in one transaction with the
// invoice locked first, so two people recording at once can't overpay it; the
// invoice then recomputes its own status from what's settled.

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

function audit(
  tx: Executor,
  actor: OrgActor,
  action: "payment.recorded" | "payment.voided" | "payment.deleted" | "payment.restored",
  paymentId: string, metadata: Record<string, unknown>) {
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
  const limited = recipients.length > 0 ? await emailLimitReached(db, actor, now, recipients.length) : null;
  if (limited) {
    return { ok: false, error: documentEmailLimitMessage("Record it without emailing the acknowledgement", limited) };
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
        { organizationId: actor.organizationId, actorUserId: actor.userId },
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

export type DeletePaymentResult = { ok: true } | { ok: false; error: string } | { ok: false; notFound: true };
export type RestorePaymentResult = { ok: true; paymentId: string } | { ok: false; error: string } | { ok: false; notFound: true };

/**
 * Moves a voided payment to the recycle bin (docs/superpowers/specs/2026-10-14-owner-delete-recycle-bin-design.md).
 * Owner only. A payment that still counts has to be voided first: the void is what puts the money back on the
 * bill and takes the payment off any 2307, so a delete never changes what a customer owes.
 */
export async function deleteVoidedPayment(
  actor: OrgActor,
  paymentId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<DeletePaymentResult> {
  assertCan(actor, "records.delete");
  if (!isUuid(paymentId)) return { ok: false, notFound: true };
  const [found] = await db
    .select({ invoiceId: payments.invoiceId })
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.organizationId, actor.organizationId)));
  if (!found) return { ok: false, notFound: true };
  const customerName = (await getInvoiceLabels(actor, [found.invoiceId], db)).get(found.invoiceId)?.customerName ?? null;

  return db.transaction(async (tx): Promise<DeletePaymentResult> => {
    // Same lock order as recording and voiding: the invoice, then its payment.
    const invoice = await lockInvoiceForPayment(tx, actor, found.invoiceId);
    if (!invoice) return { ok: false, notFound: true };
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!payment) return { ok: false, notFound: true };
    if (!payment.voidedAt || payment.voidReason === null) return { ok: false, error: "Void this payment first. Then it can be deleted." };

    await putInTrash(
      tx,
      actor,
      {
        kind: "payment",
        originalId: payment.id,
        customerName,
        label: payment.receiptNumber,
        totalMinor: payment.amountMinor + payment.withheldMinor,
        currency: payment.currency,
        payload: paymentTrashPayload({
          ...payment,
          voidedAt: payment.voidedAt.toISOString(),
          voidReason: payment.voidReason,
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
        }),
      },
      now,
    );
    await tx.delete(payments).where(eq(payments.id, payment.id));
    await audit(tx, actor, "payment.deleted", payment.id, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      receiptNumber: payment.receiptNumber,
      amountMinor: payment.amountMinor,
      withheldMinor: payment.withheldMinor,
    });
    return { ok: true };
  });
}

/** Brings a deleted payment back from the recycle bin, under its own id and receipt number, still void. Owner only. */
export async function restoreDeletedPayment(
  actor: OrgActor,
  trashId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<RestorePaymentResult> {
  assertCan(actor, "records.delete");
  return db.transaction(async (tx): Promise<RestorePaymentResult> => {
    const taken = await takeFromTrash(tx, actor, "payment", trashId, now);
    if (!taken) return { ok: false, notFound: true };
    const parsed = parsePaymentTrashPayload(taken.payload);
    // Rolls back, so the item stays in the bin rather than vanishing unread.
    if (!parsed.ok) throw new Error("A recycle bin item for a payment couldn't be read");
    // Drizzle only reads the table's own columns, so the payload's version marker is left behind.
    const kept: Omit<typeof parsed.payload, "v"> = parsed.payload;

    const invoice = await lockInvoiceForPayment(tx, actor, kept.invoiceId);
    if (!invoice) throw new Error("A deleted payment's billing statement is gone");
    await tx.insert(payments).values({
      ...kept,
      id: taken.originalId,
      organizationId: actor.organizationId,
      voidedAt: new Date(kept.voidedAt),
      createdAt: new Date(kept.createdAt),
      updatedAt: new Date(kept.updatedAt),
    });
    await audit(tx, actor, "payment.restored", taken.originalId, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      receiptNumber: kept.receiptNumber,
      amountMinor: kept.amountMinor,
      withheldMinor: kept.withheldMinor,
    });
    return { ok: true, paymentId: taken.originalId };
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

/** A payment on the Payments list, with the billing statement it settles and who it is for. */
export type PaymentListItem = Payment & { invoiceNumber: string | null; customerName: string | null };

export type PaymentList = PageMeta & { payments: PaymentListItem[]; total: number };

/**
 * Every payment the business recorded, newest first, optionally searched by receipt number, reference, who paid,
 * bank or wallet, or the billing statement's number or customer. `withholding: "pending"` keeps only the payments
 * still waiting for a 2307.
 */
export async function listPayments(
  actor: OrgActor,
  {
    search = null,
    page = 1,
    pageSize,
    withholding,
  }: { search?: string | null; page?: number; pageSize?: number; withholding?: "pending" },
  db: Database = getDb(),
): Promise<PaymentList> {
  assertCan(actor, "payments.read");
  const ofOrganization = eq(payments.organizationId, actor.organizationId);
  let matches;
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const invoiceIds = await findInvoiceIds(actor, search, db);
    matches = or(
      ilike(payments.receiptNumber, pattern),
      ilike(payments.reference, pattern),
      ilike(payments.payerName, pattern),
      ilike(payments.institution, pattern),
      invoiceIds.length > 0 ? inArray(payments.invoiceId, invoiceIds) : undefined,
    );
  }
  // "2307 pending": active, tax withheld, and no certificate has it yet.
  const pending =
    withholding === "pending"
      ? and(
          isNull(payments.voidedAt),
          sql`${payments.withheldMinor} > 0`,
          notExists(
            db
              .select({ one: sql`1` })
              .from(withholdingCertificatePayments)
              .where(eq(withholdingCertificatePayments.paymentId, payments.id)),
          ),
        )
      : undefined;
  const where = and(ofOrganization, matches, pending);

  const [[matching], [total]] = await Promise.all([
    db.select({ value: count() }).from(payments).where(where),
    db.select({ value: count() }).from(payments).where(ofOrganization),
  ]);
  const window = pageWindow({ page, pageSize, matching: matching?.value ?? 0 });
  const rows = await db
    .select(columns)
    .from(payments)
    .where(where)
    .orderBy(desc(payments.paidOn), desc(payments.createdAt), desc(payments.id))
    .limit(window.pageSize)
    .offset(window.offset);
  const labels = await getInvoiceLabels(actor, [...new Set(rows.map((row) => row.invoiceId))], db);
  return {
    payments: rows.map((row) => ({
      ...row,
      invoiceNumber: labels.get(row.invoiceId)?.number ?? null,
      customerName: labels.get(row.invoiceId)?.customerName ?? null,
    })),
    ...pageMeta(window),
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
): Promise<{ currency: string; receivedMinor: number; paymentCount: number }[]> {
  assertCan(actor, "payments.read");
  return db
    .select({
      currency: payments.currency,
      receivedMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::bigint`.mapWith(Number),
      paymentCount: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(payments)
    .where(and(eq(payments.organizationId, actor.organizationId), isNull(payments.voidedAt), gte(payments.paidOn, since)))
    .groupBy(payments.currency)
    .orderBy(payments.currency);
}
