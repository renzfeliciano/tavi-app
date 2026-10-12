import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type Database, type Executor, getDb, isUniqueViolation } from "@/db";
import { customers, files, invoices } from "@/db/schema";
import { assertCan, type OrgActor } from "@/modules/authz";
import { removeWithholdingScan } from "@/modules/files";
import { getDocumentSettings } from "@/modules/organizations";
import { type CalendarDate, compareDates, todayIn } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";
import {
  type CertificateInput,
  LINK_MESSAGES,
  parseCertificateInput,
  type RawCertificate,
} from "../domain/withholding";
import { payments, withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "../schema";
import { auditCertificate } from "./certificate-audit";
import { MAX_REASON } from "./payments";

// Recording, editing and voiding withholding certificates (PH: BIR Form 2307).
// Each runs in one transaction. The payments a certificate covers are locked in
// id order before the links are written, so two certificates can't take the
// same payment, and voiding a payment can't slip past a link being made
// (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md).

export type CertificateResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

export type VoidCertificateResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

export type CertificateOptions = {
  /** The business's market: its currency, and whether it has withheld tax at all. */
  market: MarketProfile;
  /** The scan, already uploaded. On an update: undefined keeps the current scan, null removes it, an id replaces it. */
  fileId?: string | null;
  now?: Date;
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;

const MESSAGES = {
  unavailable: "Withholding certificates aren't available for this business.",
  customer: "Choose who sent this 2307.",
  scan: "That scan couldn't be attached. Upload it again.",
  voidedCertificate: "This 2307 is void and can't be changed.",
  alreadyVoid: "This 2307 is already void.",
} as const;

type LinkRules = {
  customerId: string;
  currency: string;
  periodFrom: CalendarDate;
  periodTo: CalendarDate;
  /** The certificate being edited: its own links don't count as "on another 2307". */
  exceptCertificateId?: string;
};

/**
 * Locks the payments (in id order) and returns the wording for the first rule
 * they break, or null when every one can go on the certificate.
 */
async function linkProblem(tx: Executor, actor: OrgActor, paymentIds: readonly string[], rules: LinkRules): Promise<string | null> {
  if (paymentIds.length === 0) return null;
  const rows = await tx
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      withheldMinor: payments.withheldMinor,
      currency: payments.currency,
      paidOn: payments.paidOn,
      voidedAt: payments.voidedAt,
    })
    .from(payments)
    .where(and(eq(payments.organizationId, actor.organizationId), inArray(payments.id, [...paymentIds])))
    .orderBy(payments.id)
    .for("update");
  if (rows.length !== paymentIds.length) return LINK_MESSAGES.notFound;

  const [owners, links] = await Promise.all([
    tx
      .select({ id: invoices.id, customerId: invoices.customerId })
      .from(invoices)
      .where(inArray(invoices.id, [...new Set(rows.map((row) => row.invoiceId))])),
    tx
      .select({ paymentId: withholdingCertificatePayments.paymentId, certificateId: withholdingCertificatePayments.certificateId })
      .from(withholdingCertificatePayments)
      .where(inArray(withholdingCertificatePayments.paymentId, [...paymentIds])),
  ]);
  const customerOf = new Map(owners.map((owner) => [owner.id, owner.customerId]));
  const onAnother = new Set(links.filter((link) => link.certificateId !== rules.exceptCertificateId).map((link) => link.paymentId));

  for (const row of rows) {
    if (customerOf.get(row.invoiceId) !== rules.customerId) return LINK_MESSAGES.otherCustomer;
    if (row.voidedAt) return LINK_MESSAGES.voided;
    if (row.withheldMinor <= 0) return LINK_MESSAGES.noWithheld;
    if (row.currency !== rules.currency) return LINK_MESSAGES.currency;
    if (compareDates(row.paidOn, rules.periodFrom) < 0 || compareDates(row.paidOn, rules.periodTo) > 0) return LINK_MESSAGES.outsidePeriod;
    if (onAnother.has(row.id)) return LINK_MESSAGES.alreadyLinked;
  }
  return null;
}

/** A scan can be attached if it is this business's own 2307 scan and no other certificate has it. */
async function scanProblem(tx: Executor, actor: OrgActor, fileId: string, exceptCertificateId?: string): Promise<string | null> {
  if (!isUuid(fileId)) return MESSAGES.scan;
  const [file] = await tx
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.organizationId, actor.organizationId), eq(files.purpose, "withholding_certificate")));
  if (!file) return MESSAGES.scan;
  const holders = await tx.select({ id: withholdingCertificates.id }).from(withholdingCertificates).where(eq(withholdingCertificates.fileId, fileId));
  return holders.some((holder) => holder.id !== exceptCertificateId) ? MESSAGES.scan : null;
}

const lineRows = (actor: OrgActor, certificateId: string, input: CertificateInput) =>
  input.lines.map((line) => ({
    organizationId: actor.organizationId,
    certificateId,
    position: line.position,
    atcCode: line.atcCode,
    description: line.description,
    rateBps: line.rateBps,
    month1Minor: line.monthMinor[0],
    month2Minor: line.monthMinor[1],
    month3Minor: line.monthMinor[2],
    totalMinor: line.totalMinor,
    taxWithheldMinor: line.taxWithheldMinor,
  }));

const linkRows = (actor: OrgActor, certificateId: string, paymentIds: readonly string[]) =>
  paymentIds.map((paymentId) => ({ organizationId: actor.organizationId, certificateId, paymentId }));

const taxWithheldOf = (input: CertificateInput) => input.lines.reduce((sum, line) => sum + line.taxWithheldMinor, 0);

const alreadyLinked: CertificateResult = { ok: false, errors: { paymentIds: LINK_MESSAGES.alreadyLinked } };

/** Records a certificate with its rows and the payments it covers. Needs `payments.record`. */
export async function recordCertificate(
  actor: OrgActor,
  raw: RawCertificate,
  { market, fileId, now = new Date() }: CertificateOptions,
  db: Database = getDb(),
): Promise<CertificateResult> {
  assertCan(actor, "payments.record");
  if (!market.taxWithheld) return { ok: false, error: MESSAGES.unavailable };
  const settings = await getDocumentSettings(actor, db);
  const parsed = parseCertificateInput(raw, { currency: market.currency, locale: settings.locale, today: todayIn(settings.timezone, now) });
  if (!parsed.ok) return parsed;
  const input = parsed.value;

  try {
    return await db.transaction(async (tx): Promise<CertificateResult> => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), eq(customers.organizationId, actor.organizationId)));
      if (!customer) return { ok: false, errors: { customerId: MESSAGES.customer } };
      if (fileId) {
        const problem = await scanProblem(tx, actor, fileId);
        if (problem) return { ok: false, error: problem };
      }
      const problem = await linkProblem(tx, actor, input.paymentIds, {
        customerId: input.customerId,
        currency: market.currency,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
      });
      if (problem) return { ok: false, errors: { paymentIds: problem } };

      const [row] = await tx
        .insert(withholdingCertificates)
        .values({
          organizationId: actor.organizationId,
          customerId: input.customerId,
          payorTin: input.payorTin,
          payorName: input.payorName,
          payorAddress: input.payorAddress,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          receivedOn: input.receivedOn,
          currency: market.currency,
          fileId: fileId ?? null,
          notes: input.notes,
          createdBy: actor.userId,
        })
        .returning({ id: withholdingCertificates.id });
      if (!row) throw new Error("Certificate insert returned no row");
      await tx.insert(withholdingCertificateLines).values(lineRows(actor, row.id, input));
      if (input.paymentIds.length > 0) await tx.insert(withholdingCertificatePayments).values(linkRows(actor, row.id, input.paymentIds));

      await auditCertificate(tx, actor, "withholding_certificate.recorded", row.id, {
        customerId: input.customerId,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        lineCount: input.lines.length,
        linkedCount: input.paymentIds.length,
        taxWithheldMinor: taxWithheldOf(input),
        currency: market.currency,
        hasScan: Boolean(fileId),
      });
      return { ok: true, id: row.id };
    });
  } catch (error) {
    // Two certificates raced for the same payment and the other one won.
    if (isUniqueViolation(error, "withholding_certificate_payments_payment_unique")) return alreadyLinked;
    throw error;
  }
}

/**
 * Replaces a certificate's header, rows and links. The customer can't change,
 * and a voided certificate can't be edited. Needs `payments.record`.
 */
export async function updateCertificate(
  actor: OrgActor,
  id: string,
  raw: RawCertificate,
  { fileId, now = new Date() }: CertificateOptions,
  db: Database = getDb(),
): Promise<CertificateResult> {
  assertCan(actor, "payments.record");
  if (!isUuid(id)) return { ok: false, notFound: true };
  const settings = await getDocumentSettings(actor, db);
  const today = todayIn(settings.timezone, now);

  try {
    return await db.transaction(async (tx): Promise<CertificateResult> => {
      const [existing] = await tx
        .select({
          customerId: withholdingCertificates.customerId,
          currency: withholdingCertificates.currency,
          fileId: withholdingCertificates.fileId,
          voidedAt: withholdingCertificates.voidedAt,
        })
        .from(withholdingCertificates)
        .where(and(eq(withholdingCertificates.id, id), eq(withholdingCertificates.organizationId, actor.organizationId)))
        .for("update");
      if (!existing) return { ok: false, notFound: true };
      if (existing.voidedAt) return { ok: false, error: MESSAGES.voidedCertificate };

      const parsed = parseCertificateInput({ ...raw, customerId: existing.customerId }, { currency: existing.currency, locale: settings.locale, today });
      if (!parsed.ok) return parsed;
      const input = parsed.value;

      let nextFileId = existing.fileId;
      if (fileId === null) nextFileId = null;
      else if (typeof fileId === "string" && fileId !== existing.fileId) {
        const problem = await scanProblem(tx, actor, fileId, id);
        if (problem) return { ok: false, error: problem };
        nextFileId = fileId;
      }
      const problem = await linkProblem(tx, actor, input.paymentIds, {
        customerId: existing.customerId,
        currency: existing.currency,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        exceptCertificateId: id,
      });
      if (problem) return { ok: false, errors: { paymentIds: problem } };

      const [linesBefore, linksBefore] = await Promise.all([
        tx.select({ id: withholdingCertificateLines.id }).from(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, id)),
        tx.select({ id: withholdingCertificatePayments.paymentId }).from(withholdingCertificatePayments).where(eq(withholdingCertificatePayments.certificateId, id)),
      ]);

      await tx
        .update(withholdingCertificates)
        .set({
          payorTin: input.payorTin,
          payorName: input.payorName,
          payorAddress: input.payorAddress,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          receivedOn: input.receivedOn,
          notes: input.notes,
          fileId: nextFileId,
        })
        .where(eq(withholdingCertificates.id, id));
      await tx.delete(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, id));
      await tx.delete(withholdingCertificatePayments).where(eq(withholdingCertificatePayments.certificateId, id));
      await tx.insert(withholdingCertificateLines).values(lineRows(actor, id, input));
      if (input.paymentIds.length > 0) await tx.insert(withholdingCertificatePayments).values(linkRows(actor, id, input.paymentIds));
      if (existing.fileId && nextFileId !== existing.fileId) await removeWithholdingScan(tx, actor, existing.fileId);

      await auditCertificate(tx, actor, "withholding_certificate.updated", id, {
        linesBefore: linesBefore.length,
        linesAfter: input.lines.length,
        linkedBefore: linksBefore.length,
        linkedAfter: input.paymentIds.length,
        taxWithheldMinor: taxWithheldOf(input),
        scan: nextFileId === existing.fileId ? "kept" : nextFileId === null ? "removed" : existing.fileId ? "replaced" : "added",
      });
      return { ok: true, id };
    });
  } catch (error) {
    if (isUniqueViolation(error, "withholding_certificate_payments_payment_unique")) return alreadyLinked;
    throw error;
  }
}

/**
 * Voids a certificate with a reason (never deleted). Its links go, so its
 * payments are waiting for a 2307 again. Needs `payments.void`.
 */
export async function voidCertificate(
  actor: OrgActor,
  id: string,
  rawReason: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<VoidCertificateResult> {
  assertCan(actor, "payments.void");
  const reason = rawReason.trim();
  if (!reason) return { ok: false, errors: { reason: "Give a reason. It's kept with the record." } };
  if (reason.length > MAX_REASON) return { ok: false, errors: { reason: tooLong(MAX_REASON) } };
  if (!isUuid(id)) return { ok: false, notFound: true };

  return db.transaction(async (tx): Promise<VoidCertificateResult> => {
    const [certificate] = await tx
      .select({ voidedAt: withholdingCertificates.voidedAt })
      .from(withholdingCertificates)
      .where(and(eq(withholdingCertificates.id, id), eq(withholdingCertificates.organizationId, actor.organizationId)))
      .for("update");
    if (!certificate) return { ok: false, notFound: true };
    if (certificate.voidedAt) return { ok: false, error: MESSAGES.alreadyVoid };

    const unlinked = await tx
      .delete(withholdingCertificatePayments)
      .where(eq(withholdingCertificatePayments.certificateId, id))
      .returning({ paymentId: withholdingCertificatePayments.paymentId });
    await tx
      .update(withholdingCertificates)
      .set({ voidedAt: now, voidReason: reason, voidedBy: actor.userId })
      .where(eq(withholdingCertificates.id, id));
    await auditCertificate(tx, actor, "withholding_certificate.voided", id, {
      reason,
      unlinkedPaymentIds: unlinked.map((link) => link.paymentId),
    });
    return { ok: true };
  });
}
