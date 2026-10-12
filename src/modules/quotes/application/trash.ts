import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import { quantityToNumeric } from "@/modules/documents";
import { takeFromTrash } from "@/modules/trash";
import { parseQuoteTrashPayload } from "../domain/trash-payload";
import { quoteLines, quotes } from "../schema";
import { audit } from "./quotes";

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
