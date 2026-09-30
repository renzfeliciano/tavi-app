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
import { customerForDocumentAction } from "../../_documents/actions";
import { DocumentEditor, type DocumentEditorState } from "../../_documents/document-editor";
import { documentBusiness, editorContext } from "../../_documents/editor-props";
import { deleteDraftQuoteAction, saveQuoteDraftAction, sendQuoteAction } from "../actions";
import { SentQuoteActions } from "../_components/sent-quote-actions";
import { quoteDocumentView } from "../_lib/quote-view";

export const metadata: Metadata = { title: "Quote" };

/** A saved draft back into the editor's typed form. */
function toEditorState(quote: QuoteDetail, locale: string): DocumentEditorState {
  return {
    customerId: quote.customerId ?? "",
    currency: quote.currency,
    issueDate: quote.issueDate,
    endDate: quote.validUntil,
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
      editorContext(ctx, "quote", quote.currency),
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
        <DocumentEditor
          {...editor}
          kind="quote"
          documentId={quote.id}
          actions={{ saveDraft: saveQuoteDraftAction, deleteDraft: deleteDraftQuoteAction, send: sendQuoteAction }}
          number={quote.number}
          revision={quote.revision}
          taxMode={quote.taxMode}
          initialCustomer={customer}
          initial={toEditorState(quote, ctx.locale)}
        />
      </>
    );
  }

  // A sent quote is read-only; changes go through a revision (§B.3).
  const view = quoteDocumentView(quote, { business: await documentBusiness(ctx), market: ctx.market, locale: ctx.locale });
  const name = `${title} ${quote.number ?? ""}`.trim();
  const when = (date: Date | null) =>
    date ? new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeStyle: "short", timeZone: ctx.timezone }).format(date) : null;
  const sentOn = quote.sentAt
    ? new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeZone: ctx.timezone }).format(quote.sentAt)
    : null;
  // What the customer did from the link (§B.3).
  const decision =
    quote.status === "APPROVED" && quote.decidedAt
      ? `Approved by ${quote.decisionName ?? "the customer"} · ${when(quote.decidedAt)}`
      : quote.status === "REJECTED" && quote.decidedAt
        ? `Declined · ${when(quote.decidedAt)}${quote.decisionNote ? ` · “${quote.decisionNote}”` : ""}`
        : quote.viewedAt && quote.status === "VIEWED"
          ? `Opened by the customer · ${when(quote.viewedAt)}`
          : null;

  return (
    <>
      <BackLink href="/quotes">Quotes</BackLink>
      <PageHeader
        title={quote.revision > 1 ? `${name} · Rev ${quote.revision}` : name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="quote" status={quote.status} />
            <span>
              {quote.customerSnapshot?.displayName}
              {sentOn ? ` · Sent ${sentOn}` : ""}
            </span>
          </span>
        }
        actions={
          <SentQuoteActions
            id={quote.id}
            status={quote.status}
            name={name}
            shareChannels={ctx.market.shareChannels}
            convertedInvoiceId={quote.convertedInvoiceId}
            invoiceTitle={ctx.market.documents.invoice.singular}
          />
        }
      />
      {decision && (
        <p role="status" className="mt-4 max-w-3xl rounded-lg border border-border bg-card px-4 py-3 text-sm text-pretty">
          {decision}
        </p>
      )}
      <div className="mt-6 max-w-3xl">
        <DocumentPaper view={view} />
      </div>
    </>
  );
}
