import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer, getCustomerNames } from "@/modules/customers";
import type { SellerSnapshot } from "@/modules/organizations";
import { quantityToNumeric, revokeShareLinks } from "@/modules/documents";
import { putInTrash, takeFromTrash } from "@/modules/trash";
import { parseQuoteTrashPayload, parseSentQuoteTrashPayload, sentQuoteTrashPayload } from "../domain/trash-payload";
import { type CustomerSnapshot, quoteLines, quotes } from "../schema";
import { audit, loadLines, type QuoteCommandResult } from "./quotes";

export type RestoreQuoteResult = { ok: true; quoteId: string } | { ok: false; notFound: true };

/**
 * Brings a deleted draft quote back from the recycle bin (D27), under the id
 * it had, as a draft with its lines and totals as they were. Gone, lapsed or
 * someone else's: not found.
 */
export async function restoreDeletedQuote(
  actor: OrgActor,
  trashId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<RestoreQuoteResult> {
  assertCan(actor, "quotes.write");
  return db.transaction(async (tx) => {
    const taken = await takeFromTrash(tx, actor, "quote", trashId, now);
    if (!taken) return { ok: false as const, notFound: true as const };
    const parsed = parseQuoteTrashPayload(taken.payload);
    // Rolls back, so the item stays in the bin rather than vanishing unread.
    if (!parsed.ok) throw new Error("A recycle bin item for a quote couldn't be read");
    const { header, lines } = parsed.payload;

    const customer = header.customerId ? await getCustomer(actor, header.customerId, db) : null;
    await tx.insert(quotes).values({
      ...header,
      id: taken.originalId,
      organizationId: actor.organizationId,
      customerId: customer ? customer.id : null,
      status: "DRAFT",
      createdBy: actor.userId,
    });
    if (lines.length > 0) {
      await tx.insert(quoteLines).values(
        lines.map((line) => ({
          ...line,
          organizationId: actor.organizationId,
          quoteId: taken.originalId,
          quantity: quantityToNumeric(line.quantity),
        })),
      );
    }
    await audit(tx, actor, "quote.restored", taken.originalId, { totalMinor: header.totalMinor, currency: header.currency });
    return { ok: true as const, quoteId: taken.originalId };
  });
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * Moves a quotation that was sent, in any status, to the recycle bin
 * (docs/superpowers/specs/2026-10-14-owner-delete-recycle-bin-design.md). Owner only. Its customer link is closed. One
 * that became a billing statement stays on record, because the bill points back to it; a draft that was never sent
 * goes the usual way (`deleteDraftQuote`).
 */
export async function deleteQuoteRecord(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<QuoteCommandResult> {
  assertCan(actor, "records.delete");
  if (!z.uuid().safeParse(id).success) return { ok: false, notFound: true };
  return db.transaction(async (tx): Promise<QuoteCommandResult> => {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.organizationId, actor.organizationId)))
      .for("update");
    if (!quote) return { ok: false, notFound: true };
    if (quote.number === null) return { ok: false, error: "This draft was never sent. Delete it as a draft instead." };
    if (quote.convertedInvoiceId) {
      return { ok: false, error: "This quotation became a billing statement, so it stays on record. Cancel the statement instead." };
    }
    const lines = await loadLines(tx, quote.id);
    const customerName =
      (quote.customerSnapshot as CustomerSnapshot | null)?.displayName ??
      (quote.customerId ? ((await getCustomerNames(actor, [quote.customerId], db)).get(quote.customerId) ?? null) : null);

    await revokeShareLinks(tx, { organizationId: actor.organizationId, documentKind: "quote", documentId: quote.id });
    await putInTrash(
      tx,
      actor,
      {
        kind: "sent_quote",
        originalId: quote.id,
        customerName,
        label: quote.number,
        totalMinor: quote.totalMinor,
        currency: quote.currency,
        payload: sentQuoteTrashPayload(
          {
            ...quote,
            number: quote.number,
            sentAt: iso(quote.sentAt),
            viewedAt: iso(quote.viewedAt),
            decidedAt: iso(quote.decidedAt),
            cancelledAt: iso(quote.cancelledAt),
            createdAt: quote.createdAt.toISOString(),
            updatedAt: quote.updatedAt.toISOString(),
          },
          lines,
        ),
      },
      now,
    );
    await tx.delete(quotes).where(eq(quotes.id, quote.id));
    await audit(tx, actor, "quote.deleted", quote.id, {
      number: quote.number,
      status: quote.status,
      sent: true,
      totalMinor: quote.totalMinor,
      currency: quote.currency,
    });
    return { ok: true };
  });
}

export type RestoreSentQuoteResult = { ok: true; quoteId: string } | { ok: false; notFound: true };

/**
 * Brings a deleted quotation back from the recycle bin, under its own id and number, in the status it had. Its old
 * customer link stays closed; the owner opens a new one if it is needed. Owner only.
 */
export async function restoreDeletedSentQuote(
  actor: OrgActor,
  trashId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<RestoreSentQuoteResult> {
  assertCan(actor, "records.delete");
  return db.transaction(async (tx) => {
    const taken = await takeFromTrash(tx, actor, "sent_quote", trashId, now);
    if (!taken) return { ok: false as const, notFound: true as const };
    const parsed = parseSentQuoteTrashPayload(taken.payload);
    // Rolls back, so the item stays in the bin rather than vanishing unread.
    if (!parsed.ok) throw new Error("A recycle bin item for a quotation couldn't be read");
    const { quote, lines } = parsed.payload;

    if (quote.customerId && !(await getCustomer(actor, quote.customerId, db))) {
      throw new Error("A deleted quotation's customer is gone");
    }
    await tx.insert(quotes).values({
      ...quote,
      id: taken.originalId,
      organizationId: actor.organizationId,
      customerSnapshot: quote.customerSnapshot as CustomerSnapshot | null,
      sellerSnapshot: quote.sellerSnapshot as SellerSnapshot | null,
      sentAt: toDate(quote.sentAt),
      viewedAt: toDate(quote.viewedAt),
      decidedAt: toDate(quote.decidedAt),
      cancelledAt: toDate(quote.cancelledAt),
      createdAt: new Date(quote.createdAt),
      updatedAt: new Date(quote.updatedAt),
    });
    if (lines.length > 0) {
      await tx.insert(quoteLines).values(
        lines.map((line) => ({
          ...line,
          organizationId: actor.organizationId,
          quoteId: taken.originalId,
          quantity: quantityToNumeric(line.quantity),
        })),
      );
    }
    await audit(tx, actor, "quote.restored", taken.originalId, {
      number: quote.number,
      status: quote.status,
      sent: true,
      totalMinor: quote.totalMinor,
      currency: quote.currency,
    });
    return { ok: true as const, quoteId: taken.originalId };
  });
}

const toDate = (value: string | null) => (value ? new Date(value) : null);
