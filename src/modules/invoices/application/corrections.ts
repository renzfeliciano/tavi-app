import { eq, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getDocumentSettings } from "@/modules/organizations";
import { addDays, todayIn } from "@/shared/dates/calendar";
import { issuedEditProblems, parseInvoiceReason } from "../domain/corrections";
import { parseInvoiceDraft } from "../domain/invoice-draft";
import type { QualifiedDiscountConfig } from "../domain/qualified-discount";
import { issuedInvoiceStatus } from "../domain/issuing";
import { transitionInvoice } from "../domain/transitions";
import { invoiceLines, invoices } from "../schema";
import {
  audit,
  calculate,
  copyLines,
  headerAmounts,
  type InvoiceCommandResult,
  lineRows,
  loadHeader,
  loadLines,
  resolveDraft,
} from "./invoices";

// Correcting an issued invoice (§B.4): edit before any payment (D7), void or
// cancel with a reason (D6), and void & duplicate for anything else. Numbers
// are never reused or freed.

export type EditIssuedInvoiceResult =
  | { ok: true; revision: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

const NOT_EDITABLE = "Only a sent, unpaid invoice can be edited. Use void & duplicate instead.";

/**
 * Saves changes to a sent invoice with no payments: lines, dates, notes and
 * terms (not the customer or currency). The revision goes up, the full
 * before/after is audited, the status is recomputed, and the customer's link
 * shows the new version.
 */
export async function editIssuedInvoice(
  actor: OrgActor,
  id: string,
  input: unknown,
  {
    locale,
    units = null,
    qualifiedDiscounts = null,
  }: { locale: string; units?: readonly string[] | null; qualifiedDiscounts?: QualifiedDiscountConfig | null },
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<EditIssuedInvoiceResult> {
  assertCan(actor, "invoices.write");
  const parsed = parseInvoiceDraft(input, { locale, units, qualifiedDiscounts });
  if (!parsed.ok) return parsed;
  const draft = parsed.draft;

  const current = await loadHeader(db, actor, id);
  if (!current) return { ok: false, notFound: true };
  if (!transitionInvoice(current.status, "edit").ok) return { ok: false, error: NOT_EDITABLE };
  const currentLines = await loadLines(db, current.id);
  const problems = issuedEditProblems(current, {
    customerId: draft.customerId,
    currency: draft.currency,
    lineCount: draft.lines.length,
  });
  if (problems.form) return { ok: false, error: problems.form };
  if (Object.keys(problems).length > 0) return { ok: false, errors: problems };

  const resolved = await resolveDraft(
    actor,
    draft,
    { customerId: current.customerId, taxRateIds: new Set(currentLines.flatMap((l) => (l.taxRateId ? [l.taxRateId] : []))) },
    db,
  );
  if (!resolved.ok) return resolved;
  const calculated = calculate(current.taxMode, resolved.lines, draft.qualifiedDiscount);
  if (!calculated.ok) return calculated;
  const { amounts } = calculated;
  const settings = await getDocumentSettings(actor, db);

  return db.transaction(async (tx): Promise<EditIssuedInvoiceResult> => {
    const locked = await loadHeader(tx, actor, id, true);
    if (!locked) return { ok: false, notFound: true };
    // Re-check under the lock: a payment or another edit may have landed.
    if (!transitionInvoice(locked.status, "edit").ok || locked.amountPaidMinor > 0 || locked.revision !== current.revision) {
      return { ok: false, error: "This invoice changed while you were editing. Reload to see the latest version." };
    }
    const status = issuedInvoiceStatus(
      { totalMinor: amounts.totalMinor, paidMinor: locked.amountPaidMinor, dueDate: draft.dueDate },
      todayIn(settings.timezone, now),
    );
    const revision = locked.revision + 1;
    await tx
      .update(invoices)
      .set({
        issueDate: draft.issueDate,
        dueDate: draft.dueDate,
        notes: draft.notes,
        terms: draft.terms,
        ...headerAmounts(amounts, draft.qualifiedDiscount),
        status,
        revision,
        editedAt: sql`now()`,
      })
      .where(eq(invoices.id, locked.id));
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, locked.id));
    const newLines = lineRows({ organizationId: actor.organizationId, invoiceId: locked.id }, resolved.lines, amounts);
    await tx.insert(invoiceLines).values(newLines);

    // The full before/after, so every change to an issued document can be read back (D7).
    const snapshot = (h: typeof locked, lines: { description: string; quantity: unknown; unitPriceMinor: number; totalMinor: number }[]) => ({
      issueDate: h.issueDate,
      dueDate: h.dueDate,
      notes: h.notes,
      terms: h.terms,
      totalMinor: h.totalMinor,
      taxTotalMinor: h.taxTotalMinor,
      qualifiedDiscount: h.qualifiedDiscount,
      lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })),
    });
    await audit(tx, actor, "invoice.edited", locked.id, {
      number: locked.number,
      fromRevision: locked.revision,
      toRevision: revision,
      before: snapshot(locked, currentLines),
      after: snapshot(
        {
          ...locked,
          ...draft,
          totalMinor: amounts.totalMinor,
          taxTotalMinor: amounts.taxTotalMinor,
          qualifiedDiscount: draft.qualifiedDiscount,
        },
        newLines.map((l) => ({ ...l, quantity: l.quantity })),
      ),
    });
    return { ok: true, revision };
  });
}

type CloseKind = "void" | "cancel";

/** Voids (issued in error) or cancels (sale called off) an unpaid invoice; its number stays used (D6). */
async function closeInvoice(
  actor: OrgActor,
  id: string,
  kind: CloseKind,
  rawReason: string,
  db: Database,
): Promise<InvoiceCommandResult | { ok: false; errors: Record<string, string> }> {
  assertCan(actor, "invoices.void");
  const reason = parseInvoiceReason(rawReason);
  if (!reason.ok) return { ok: false, errors: { reason: reason.error } };
  return db.transaction(async (tx) => {
    const invoice = await loadHeader(tx, actor, id, true);
    if (!invoice) return { ok: false as const, notFound: true as const };
    if (!transitionInvoice(invoice.status, kind).ok || invoice.amountPaidMinor > 0) {
      return {
        ok: false as const,
        error: `Only a sent invoice with no payments can be ${kind === "void" ? "voided" : "cancelled"}.`,
      };
    }
    await tx
      .update(invoices)
      .set(
        kind === "void"
          ? { status: "VOID", voidedAt: sql`now()`, voidReason: reason.reason }
          : { status: "CANCELLED", cancelledAt: sql`now()`, cancelReason: reason.reason },
      )
      .where(eq(invoices.id, invoice.id));
    await audit(tx, actor, kind === "void" ? "invoice.voided" : "invoice.cancelled", invoice.id, {
      number: invoice.number,
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
      reason: reason.reason,
    });
    return { ok: true as const };
  });
}

export function voidInvoice(actor: OrgActor, id: string, reason: string, db: Database = getDb()) {
  return closeInvoice(actor, id, "void", reason, db);
}

export function cancelInvoice(actor: OrgActor, id: string, reason: string, db: Database = getDb()) {
  return closeInvoice(actor, id, "cancel", reason, db);
}

export type VoidAndDuplicateResult =
  | { ok: true; duplicateId: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

/**
 * One-step correction: voids the invoice and opens a new draft with the same
 * customer, items, notes and terms, dated today (§B.4). The void and the
 * draft commit together.
 */
export async function voidAndDuplicateInvoice(
  actor: OrgActor,
  id: string,
  rawReason: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<VoidAndDuplicateResult> {
  assertCan(actor, "invoices.void");
  assertCan(actor, "invoices.write");
  const reason = parseInvoiceReason(rawReason);
  if (!reason.ok) return { ok: false, errors: { reason: reason.error } };
  const settings = await getDocumentSettings(actor, db);

  return db.transaction(async (tx): Promise<VoidAndDuplicateResult> => {
    const invoice = await loadHeader(tx, actor, id, true);
    if (!invoice) return { ok: false, notFound: true };
    if (!transitionInvoice(invoice.status, "void").ok || invoice.amountPaidMinor > 0) {
      return { ok: false, error: "Only a sent invoice with no payments can be voided." };
    }
    const lines = await loadLines(tx, invoice.id);
    await tx
      .update(invoices)
      .set({ status: "VOID", voidedAt: sql`now()`, voidReason: reason.reason })
      .where(eq(invoices.id, invoice.id));

    const issueDate = todayIn(settings.timezone, now);
    const [copy] = await tx
      .insert(invoices)
      .values({
        organizationId: actor.organizationId,
        customerId: invoice.customerId,
        currency: invoice.currency,
        taxMode: invoice.taxMode,
        issueDate,
        dueDate: addDays(issueDate, settings.paymentTermsDays),
        notes: invoice.notes,
        terms: invoice.terms,
        subtotalMinor: invoice.subtotalMinor,
        discountTotalMinor: invoice.discountTotalMinor,
        taxTotalMinor: invoice.taxTotalMinor,
        totalMinor: invoice.totalMinor,
        // The buyer's qualified discount goes with the items (D19).
        qualifiedDiscount: invoice.qualifiedDiscount,
        qualifiedDiscountMinor: invoice.qualifiedDiscountMinor,
        taxWaivedMinor: invoice.taxWaivedMinor,
        createdBy: actor.userId,
      })
      .returning({ id: invoices.id });
    if (!copy) throw new Error("Invoice insert returned no row");
    if (lines.length > 0) {
      await tx.insert(invoiceLines).values(copyLines(lines, { organizationId: actor.organizationId, invoiceId: copy.id }));
    }
    await audit(tx, actor, "invoice.voided", invoice.id, {
      number: invoice.number,
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
      reason: reason.reason,
      duplicateId: copy.id,
    });
    await audit(tx, actor, "invoice.created", copy.id, { duplicateOf: invoice.number });
    return { ok: true, duplicateId: copy.id };
  });
}
