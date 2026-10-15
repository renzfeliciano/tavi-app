import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import { allocateDocumentNumber } from "@/modules/documents";
import { documentEmailLimitMessage, emailLimitReached, enqueueEmail, receiptEmail } from "@/modules/notifications";
import { getBusinessProfile, getDocumentSettings, sellerFrom, withSeller } from "@/modules/organizations";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { type PageMeta, pageMeta, pageWindow } from "@/shared/pagination/page-window";
import { escapeLikePattern } from "@/shared/text/search";
import { tooLong } from "@/shared/validation/messages";
import { parseAckRecipients } from "../domain/ack-recipients";
import { parseIdempotencyKey } from "../domain/idempotency";
import { paymentProofRows } from "../domain/payment-proof";
import { parseReceiptInput, RECEIPT_LIMITS, type RawReceipt } from "../domain/receipt-input";
import { receipts } from "../schema";

// Receipts for money that is not an invoice payment: issue, void, email, read.
// Docs: docs/superpowers/specs/2026-10-15-receipts-design.md. A receipt takes its number from the same series as payment
// acknowledgements, inside the transaction that inserts it, so a refusal never uses up a number.

export type Receipt = Omit<typeof receipts.$inferSelect, "organizationId" | "idempotencyKey">;

const columns = {
  id: receipts.id,
  kind: receipts.kind,
  receiptNumber: receipts.receiptNumber,
  customerId: receipts.customerId,
  payerName: receipts.payerName,
  amountMinor: receipts.amountMinor,
  currency: receipts.currency,
  receivedOn: receipts.receivedOn,
  method: receipts.method,
  reference: receipts.reference,
  institution: receipts.institution,
  paidTime: receipts.paidTime,
  chequeDate: receipts.chequeDate,
  purpose: receipts.purpose,
  notes: receipts.notes,
  seller: receipts.seller,
  issuedBy: receipts.issuedBy,
  voidedAt: receipts.voidedAt,
  voidReason: receipts.voidReason,
  voidedBy: receipts.voidedBy,
  createdAt: receipts.createdAt,
  updatedAt: receipts.updatedAt,
};

const isUuid = (value: unknown): value is string => z.uuid().safeParse(value).success;
const RETRY = "That request wasn't valid. Please try again.";
export const MAX_RECEIPT_REASON = RECEIPT_LIMITS.reason;

function audit(tx: Executor, actor: OrgActor, action: AuditAction, receiptId: string, metadata: Record<string, unknown>) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "receipt",
    entityId: receiptId,
    metadata,
  });
}

/** Queues one email per address with the receipt's details; the business's name and address are the ones on the receipt. */
async function queueReceiptEmails(
  tx: Executor,
  actor: OrgActor,
  receipt: Receipt,
  to: readonly string[],
  { market, locale, appUrl, profile }: { market: MarketProfile; locale: string; appUrl: string | undefined; profile: Awaited<ReturnType<typeof getBusinessProfile>> },
) {
  const business = withSeller(profile, receipt.seller);
  const date = (value: string) => formatCalendarDate(value, locale);
  for (const address of to) {
    await enqueueEmail(
      tx,
      receiptEmail({
        to: address,
        businessName: business.name,
        businessEmail: business.email,
        receiptTitle: market.documents.receiptKinds[receipt.kind].title,
        receiptNumber: receipt.receiptNumber,
        payerName: receipt.payerName,
        purpose: receipt.purpose,
        received: formatMoney(receipt.amountMinor, receipt.currency, { locale }),
        receivedOn: date(receipt.receivedOn),
        details: paymentProofRows({ ...receipt, payerName: null }, market, date),
        // Receipts are supplementary documents (RR 7-2024 Sec. 6 B.15, D13).
        notice: market.supplementaryDocumentNotice,
        disclaimer: market.documents.receipt.disclaimer ?? null,
        ...(appUrl ? { appUrl } : {}),
      }),
      { organizationId: actor.organizationId, actorUserId: actor.userId },
    );
  }
}

export type IssueReceiptResult =
  | { ok: true; receiptId: string; receiptNumber: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string }
  | { ok: false; notFound: true };

export type IssueReceiptOptions = {
  /** Who gets a copy by email (none to issue without emailing). */
  recipients: readonly string[];
  /** The business's market: titles, methods and document wording. */
  market: MarketProfile;
  /** This attempt's idempotency key; a repeat with the same key returns the first result. */
  idempotencyKey?: string | null;
  /** The app's public address, where the email loads its logo from. */
  appUrl?: string;
  now?: Date;
};

/** Issues a receipt at once: the next number, the business's details as they are now, an audit event, optional emails. */
export async function issueReceipt(
  actor: OrgActor,
  raw: RawReceipt & { customerId: string },
  { recipients: rawRecipients, market, idempotencyKey: rawKey, appUrl, now = new Date() }: IssueReceiptOptions,
  db: Database = getDb(),
): Promise<IssueReceiptResult> {
  assertCan(actor, "payments.record");
  const idempotencyKey = parseIdempotencyKey(rawKey);
  if (idempotencyKey === false) return { ok: false, error: RETRY };
  const parsedRecipients = parseAckRecipients(rawRecipients);
  if (!parsedRecipients.ok) return { ok: false, errors: { recipients: parsedRecipients.error } };
  const recipients = parsedRecipients.emails;
  const [settings, profile] = await Promise.all([getDocumentSettings(actor, db), getBusinessProfile(actor, db)]);
  const today = todayIn(settings.timezone, now);
  // Checked before anything is recorded, so the person can retry without the email (§I).
  const limited = recipients.length > 0 ? await emailLimitReached(db, actor, now, recipients.length) : null;
  if (limited) return { ok: false, error: documentEmailLimitMessage("Issue the receipt without emailing it", limited) };

  return db.transaction(async (tx): Promise<IssueReceiptResult> => {
    if (idempotencyKey) {
      // Two sends of one attempt at the same moment wait for each other here, so the second finds the first.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${actor.organizationId}), hashtext(${idempotencyKey}))`);
      const [seen] = await tx
        .select({ id: receipts.id, receiptNumber: receipts.receiptNumber })
        .from(receipts)
        .where(and(eq(receipts.organizationId, actor.organizationId), eq(receipts.idempotencyKey, idempotencyKey)));
      if (seen) return { ok: true, receiptId: seen.id, receiptNumber: seen.receiptNumber };
    }

    let customerName: string | null = null;
    let customerId: string | null = null;
    if (raw.customerId.trim() !== "") {
      const customer = await getCustomer(actor, raw.customerId, tx);
      if (!customer) return { ok: false, notFound: true };
      if (customer.archivedAt) return { ok: false, error: "That customer is archived. Restore them or choose someone else." };
      customerName = customer.displayName;
      customerId = customer.id;
    }
    const parsed = parseReceiptInput(raw, { currency: settings.currency, locale: settings.locale, today, defaultPayer: customerName });
    if (!parsed.ok) return parsed;
    const input = parsed.receipt;

    const { number: receiptNumber } = await allocateDocumentNumber(tx, actor.organizationId, "receipt");
    const [made] = await tx
      .insert(receipts)
      .values({
        organizationId: actor.organizationId,
        kind: input.kind,
        receiptNumber,
        customerId,
        payerName: input.payerName,
        amountMinor: input.amountMinor,
        currency: settings.currency,
        receivedOn: input.receivedOn,
        method: input.method,
        reference: input.reference,
        institution: input.institution,
        paidTime: input.paidTime,
        chequeDate: input.chequeDate,
        purpose: input.purpose,
        notes: input.notes,
        seller: sellerFrom(profile),
        idempotencyKey,
        issuedBy: actor.userId,
      })
      .returning(columns);
    if (!made) throw new Error("Receipt insert returned no row");

    await audit(tx, actor, "receipt.issued", made.id, {
      receiptNumber,
      kind: input.kind,
      amountMinor: input.amountMinor,
      currency: settings.currency,
      method: input.method,
      customerId,
      emailsQueued: recipients.length,
    });
    if (recipients.length > 0) {
      await queueReceiptEmails(tx, actor, made, recipients, { market, locale: settings.locale, appUrl, profile });
    }
    return { ok: true, receiptId: made.id, receiptNumber };
  });
}

export type VoidReceiptResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

/** Voids a receipt with a reason. It stays in the list and its number is never reused. */
export async function voidReceipt(
  actor: OrgActor,
  id: string,
  rawReason: string,
  db: Database = getDb(),
): Promise<VoidReceiptResult> {
  assertCan(actor, "payments.void");
  const reason = rawReason.trim();
  if (!reason) return { ok: false, errors: { reason: "Give a reason. It's kept with the record." } };
  if (reason.length > MAX_RECEIPT_REASON) return { ok: false, errors: { reason: tooLong(MAX_RECEIPT_REASON) } };
  if (!isUuid(id)) return { ok: false, notFound: true };

  return db.transaction(async (tx): Promise<VoidReceiptResult> => {
    const [receipt] = await tx
      .select(columns)
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.organizationId, actor.organizationId)))
      .for("update");
    if (!receipt) return { ok: false, notFound: true };
    if (receipt.voidedAt) return { ok: false, error: "This receipt is already void." };
    await tx.update(receipts).set({ voidedAt: sql`now()`, voidReason: reason, voidedBy: actor.userId }).where(eq(receipts.id, receipt.id));
    await audit(tx, actor, "receipt.voided", receipt.id, {
      receiptNumber: receipt.receiptNumber,
      amountMinor: receipt.amountMinor,
      currency: receipt.currency,
      reason,
    });
    return { ok: true };
  });
}

export type EmailReceiptResult =
  | { ok: true; queued: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

/** Emails a copy of a receipt that is not void. */
export async function emailReceipt(
  actor: OrgActor,
  id: string,
  rawRecipients: readonly string[],
  { market, appUrl, now = new Date() }: { market: MarketProfile; appUrl?: string; now?: Date },
  db: Database = getDb(),
): Promise<EmailReceiptResult> {
  assertCan(actor, "payments.record");
  if (!isUuid(id)) return { ok: false, notFound: true };
  const parsed = parseAckRecipients(rawRecipients);
  if (!parsed.ok) return { ok: false, errors: { recipients: parsed.error } };
  if (parsed.emails.length === 0) return { ok: false, errors: { recipients: "Enter at least one email address." } };
  const [settings, profile] = await Promise.all([getDocumentSettings(actor, db), getBusinessProfile(actor, db)]);
  const limited = await emailLimitReached(db, actor, now, parsed.emails.length);
  if (limited) return { ok: false, error: documentEmailLimitMessage("Try again later", limited) };

  return db.transaction(async (tx): Promise<EmailReceiptResult> => {
    const [receipt] = await tx
      .select(columns)
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.organizationId, actor.organizationId)))
      .for("update");
    if (!receipt) return { ok: false, notFound: true };
    if (receipt.voidedAt) return { ok: false, error: "This receipt is void, so it can't be emailed." };
    await queueReceiptEmails(tx, actor, receipt, parsed.emails, { market, locale: settings.locale, appUrl, profile });
    await audit(tx, actor, "receipt.emailed", receipt.id, { receiptNumber: receipt.receiptNumber, emailsQueued: parsed.emails.length });
    return { ok: true, queued: parsed.emails.length };
  });
}

/** One receipt, for its page and PDF. */
export async function getReceipt(actor: OrgActor, id: string, db: Database = getDb()): Promise<Receipt | null> {
  assertCan(actor, "payments.read");
  if (!isUuid(id)) return null;
  const [row] = await db
    .select(columns)
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.organizationId, actor.organizationId)));
  return row ?? null;
}

export type ReceiptView = "collection" | "acknowledgement" | "voided";
export type ReceiptList = PageMeta & { receipts: Receipt[]; total: number };

/** The business's receipts, newest first, optionally searched by number, payer or purpose and narrowed to a view. */
export async function listReceipts(
  actor: OrgActor,
  { search = null, view, page = 1, pageSize }: { search?: string | null; view?: ReceiptView; page?: number; pageSize?: number },
  db: Database = getDb(),
): Promise<ReceiptList> {
  assertCan(actor, "payments.read");
  const ofOrganization = eq(receipts.organizationId, actor.organizationId);
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const matches = pattern
    ? or(ilike(receipts.receiptNumber, pattern), ilike(receipts.payerName, pattern), ilike(receipts.purpose, pattern))
    : undefined;
  // A kind's view still lists its voided receipts (marked as void); "voided" lists the void ones of either kind.
  const narrowed = view === "voided" ? isNotNull(receipts.voidedAt) : view ? eq(receipts.kind, view) : undefined;
  const where = and(ofOrganization, matches, narrowed);

  const [[matching], [total]] = await Promise.all([
    db.select({ value: count() }).from(receipts).where(where),
    db.select({ value: count() }).from(receipts).where(ofOrganization),
  ]);
  const window = pageWindow({ page, pageSize, matching: matching?.value ?? 0 });
  const rows = await db
    .select(columns)
    .from(receipts)
    .where(where)
    .orderBy(desc(receipts.receivedOn), desc(receipts.createdAt), desc(receipts.id))
    .limit(window.pageSize)
    .offset(window.offset);
  return { receipts: rows, ...pageMeta(window), total: total?.value ?? 0 };
}
