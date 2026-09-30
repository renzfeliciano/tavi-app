import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getDocumentSettings } from "@/modules/organizations";
import { lockApprovedQuoteForConversion, markQuoteConverted } from "@/modules/quotes";
import { addDays, todayIn } from "@/shared/dates/calendar";
import { invoiceLines, invoices } from "../schema";
import { audit, copyLines } from "./invoices";

// Quote → invoice (§B.4): a draft invoice with the approved quote's customer,
// lines (names, rates and amounts as approved), notes and terms, dated today
// with the business's payment terms. The person reviews it, then sends it.

export type ConvertQuoteResult =
  | { ok: true; invoiceId: string; created: boolean }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

export async function convertQuoteToInvoice(
  actor: OrgActor,
  quoteId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<ConvertQuoteResult> {
  assertCan(actor, "invoices.write");
  const settings = await getDocumentSettings(actor, db);

  return db.transaction(async (tx): Promise<ConvertQuoteResult> => {
    const found = await lockApprovedQuoteForConversion(tx, actor, quoteId);
    // A double click (or a second tab) finds the invoice the first one made.
    if (!found.ok && "convertedInvoiceId" in found) return { ok: true, invoiceId: found.convertedInvoiceId, created: false };
    if (!found.ok) return found;
    const { quote } = found;

    const issueDate = todayIn(settings.timezone, now);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        organizationId: actor.organizationId,
        customerId: quote.customerId,
        sourceQuoteId: quote.id,
        currency: quote.currency,
        taxMode: quote.taxMode,
        issueDate,
        dueDate: addDays(issueDate, settings.paymentTermsDays),
        notes: quote.notes,
        terms: quote.terms,
        subtotalMinor: quote.subtotalMinor,
        discountTotalMinor: quote.discountTotalMinor,
        taxTotalMinor: quote.taxTotalMinor,
        totalMinor: quote.totalMinor,
        createdBy: actor.userId,
      })
      .returning({ id: invoices.id });
    if (!invoice) throw new Error("Invoice insert returned no row");
    if (quote.lines.length > 0) {
      await tx
        .insert(invoiceLines)
        .values(copyLines(quote.lines, { organizationId: actor.organizationId, invoiceId: invoice.id }));
    }
    await markQuoteConverted(tx, actor, quote.id, invoice.id, quote.number);
    await audit(tx, actor, "invoice.created", invoice.id, { sourceQuoteId: quote.id, fromQuote: quote.number });
    return { ok: true, invoiceId: invoice.id, created: true };
  });
}
