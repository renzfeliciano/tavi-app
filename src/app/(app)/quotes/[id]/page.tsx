import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentPaper } from "@/components/document/document-paper";
import { StatusBadge } from "@/components/status/status-badge";
import { formatAmountForInput } from "@/shared/money";
import { formatRateForInput } from "@/shared/numbers/percent";
import { formatQuantity } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { getQuote, type QuoteDetail } from "@/modules/quotes";
import { customerForDocumentAction } from "../actions";
import { QuoteEditor, type QuoteEditorState } from "../_components/quote-editor";
import { documentBusiness, editorContext } from "../_lib/editor-props";
import { quoteDocumentView } from "../_lib/quote-view";

export const metadata: Metadata = { title: "Quote" };

/** A saved draft back into the editor's typed form. */
function toEditorState(quote: QuoteDetail, locale: string): QuoteEditorState {
  return {
    customerId: quote.customerId ?? "",
    currency: quote.currency,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    notes: quote.notes ?? "",
    terms: quote.terms ?? "",
    lines: quote.lines.map((line) => ({
      key: `line-${line.position}`,
      description: line.description,
      quantity: formatQuantity(line.quantity, locale),
      unitLabel: line.unitLabel,
      unitPrice: formatAmountForInput(line.unitPriceMinor, quote.currency, locale),
      discountKind: line.discountKind ?? "none",
      discountValue:
        line.discountKind === "percent" && line.discountValue !== null
          ? formatRateForInput(line.discountValue, locale)
          : line.discountKind === "amount" && line.discountValue !== null
            ? formatAmountForInput(line.discountValue, quote.currency, locale)
            : "",
      taxRateId: line.taxRateId ?? "",
      sourceKind: line.sourceKind ?? "",
      sourceId: line.sourceId ?? "",
    })),
  };
}

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const quote = await getQuote(ctx, id);
  if (!quote) notFound();
  const title = ctx.market.documents.quote.singular;

  if (quote.status === "DRAFT") {
    const [editor, customer] = await Promise.all([
      editorContext(ctx, quote.currency),
      quote.customerId ? customerForDocumentAction(quote.customerId) : Promise.resolve(null),
    ]);
    return (
      <>
        <BackLink href="/quotes">Quotes</BackLink>
        <PageHeader
          title={quote.number ? `${title} ${quote.number}` : `Draft ${title.toLowerCase()}`}
          description="Changes save as you go."
          actions={<StatusBadge kind="quote" status={quote.status} />}
        />
        <QuoteEditor
          {...editor}
          quoteId={quote.id}
          number={quote.number}
          revision={quote.revision}
          taxMode={quote.taxMode}
          initialCustomer={customer}
          initial={toEditorState(quote, ctx.locale)}
        />
      </>
    );
  }

  // Sent quotes are read-only here; sending, revising and cancelling arrive in 1.5b.
  const view = quoteDocumentView(quote, { business: await documentBusiness(ctx), market: ctx.market, locale: ctx.locale });

  return (
    <>
      <BackLink href="/quotes">Quotes</BackLink>
      <PageHeader
        title={`${title} ${quote.number ?? ""}`.trim()}
        description={quote.customerSnapshot?.displayName}
        actions={<StatusBadge kind="quote" status={quote.status} />}
      />
      <div className="mt-6 max-w-3xl">
        <DocumentPaper view={view} />
      </div>
    </>
  );
}
