import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import { lockApprovedQuoteForConversion, markQuoteConverted } from "@/modules/quotes";
import { takeFromTrash } from "@/modules/trash";
import { parseInvoiceTrashPayload } from "../domain/trash-payload";
import { invoiceLines, invoices } from "../schema";
import { audit, copyLines } from "./invoices";

export type RestoreInvoiceResult =
  | { ok: true; invoiceId: string; detachedFromQuote: boolean }
  | { ok: false; notFound: true };

/**
 * Brings a deleted draft back from the recycle bin (D27), under the id it had.
 * It returns as a draft with its lines and totals as they were. If it was made
 * from a quote, it goes back on that quote while the quote can still be
 * converted; if the quote has become another invoice since, it comes back on
 * its own (`detachedFromQuote`). Gone, lapsed or someone else's: not found.
 */
export async function restoreDeletedInvoice(
  actor: OrgActor,
  trashId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<RestoreInvoiceResult> {
  assertCan(actor, "invoices.write");
  return db.transaction(async (tx) => {
    const taken = await takeFromTrash(tx, actor, "invoice", trashId, now);
    if (!taken) return { ok: false as const, notFound: true as const };
    const parsed = parseInvoiceTrashPayload(taken.payload);
    // Rolls back, so the item stays in the bin rather than vanishing unread.
    if (!parsed.ok) throw new Error("A recycle bin item for an invoice couldn't be read");
    const { header, lines } = parsed.payload;

    // Each link is kept only if it still holds; the draft is otherwise complete without it.
    const customer = header.customerId ? await getCustomer(actor, header.customerId, db) : null;
    const quote = header.sourceQuoteId ? await lockApprovedQuoteForConversion(tx, actor, header.sourceQuoteId) : null;
    const relinkQuote = quote?.ok === true;

    await tx.insert(invoices).values({
      ...header,
      id: taken.originalId,
      organizationId: actor.organizationId,
      customerId: customer ? customer.id : null,
      sourceQuoteId: relinkQuote ? header.sourceQuoteId : null,
      status: "DRAFT",
      createdBy: actor.userId,
    });
    if (lines.length > 0) {
      await tx.insert(invoiceLines).values(copyLines(lines, { organizationId: actor.organizationId, invoiceId: taken.originalId }));
    }
    if (relinkQuote && header.sourceQuoteId) {
      await markQuoteConverted(tx, actor, header.sourceQuoteId, taken.originalId, null);
    }

    const detachedFromQuote = header.sourceQuoteId !== null && !relinkQuote;
    await audit(tx, actor, "invoice.restored", taken.originalId, {
      totalMinor: header.totalMinor,
      currency: header.currency,
      detachedFromQuote,
    });
    return { ok: true as const, invoiceId: taken.originalId, detachedFromQuote };
  });
}
