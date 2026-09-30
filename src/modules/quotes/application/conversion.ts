import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { transitionQuote } from "../domain/transitions";
import { quotes } from "../schema";
import { audit, loadHeader, loadLines, type QuoteHeader, type QuoteLine } from "./quotes";

// The quotes side of quote → invoice conversion (§B.4). The invoices module
// calls these inside its own transaction; it never touches the quotes tables.

export type ApprovedQuote = QuoteHeader & { lines: QuoteLine[] };

export type QuoteForConversion =
  | { ok: true; quote: ApprovedQuote }
  | { ok: false; notFound: true }
  | { ok: false; convertedInvoiceId: string }
  | { ok: false; error: string };

/** Locks an approved quote for conversion, or says why it can't be converted. */
export async function lockApprovedQuoteForConversion(
  tx: Executor,
  actor: OrgActor,
  quoteId: string,
): Promise<QuoteForConversion> {
  assertCan(actor, "quotes.read");
  const quote = await loadHeader(tx, actor, quoteId, true);
  if (!quote) return { ok: false, notFound: true };
  if (quote.convertedInvoiceId) return { ok: false, convertedInvoiceId: quote.convertedInvoiceId };
  if (!transitionQuote(quote.status, "convert").ok) {
    return { ok: false, error: "Only an approved quote can become an invoice." };
  }
  return { ok: true, quote: { ...quote, lines: await loadLines(tx, quote.id) } };
}

/** Records that the quote became this invoice; it stays APPROVED (§B.3). */
export async function markQuoteConverted(tx: Executor, actor: OrgActor, quoteId: string, invoiceId: string, number: string | null) {
  await tx
    .update(quotes)
    .set({ convertedAt: sql`now()`, convertedInvoiceId: invoiceId })
    .where(eq(quotes.id, quoteId));
  await audit(tx, actor, "quote.converted", quoteId, { number, invoiceId });
}

/** The converted draft invoice was deleted: the quote can be converted again. */
export async function clearQuoteConversion(tx: Executor, actor: OrgActor, quoteId: string, invoiceId: string) {
  await tx
    .update(quotes)
    .set({ convertedAt: null, convertedInvoiceId: null })
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, actor.organizationId), eq(quotes.convertedInvoiceId, invoiceId)));
}
