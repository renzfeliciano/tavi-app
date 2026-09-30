import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentPaper } from "@/components/document/document-paper";
import { StatusBadge } from "@/components/status/status-badge";
import { formatQuantity } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, type InvoiceDetail } from "@/modules/invoices";
import { formatAmountForInput } from "@/shared/money";
import { formatRateForInput } from "@/shared/numbers/percent";
import { customerForDocumentAction } from "../../_documents/actions";
import { DocumentEditor, type DocumentEditorState } from "../../_documents/document-editor";
import { documentBusiness, editorContext } from "../../_documents/editor-props";
import { deleteDraftInvoiceAction, saveInvoiceDraftAction, sendInvoiceAction } from "../actions";
import { SentInvoiceActions } from "../_components/sent-invoice-actions";
import { invoiceDocumentView } from "../_lib/invoice-view";

export const metadata: Metadata = { title: "Invoice" };

/** A saved draft back into the editor's typed form. */
function toEditorState(invoice: InvoiceDetail, locale: string): DocumentEditorState {
  return {
    customerId: invoice.customerId ?? "",
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    endDate: invoice.dueDate,
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    lines: invoice.lines.map((line) => ({
      key: `line-${line.position}`,
      description: line.description,
      quantity: formatQuantity(line.quantity, locale),
      unitLabel: line.unitLabel,
      unitPrice: formatAmountForInput(line.unitPriceMinor, invoice.currency, locale),
      discountKind: line.discountKind ?? "none",
      discountValue:
        line.discountKind === "percent" && line.discountValue !== null
          ? formatRateForInput(line.discountValue, locale)
          : line.discountKind === "amount" && line.discountValue !== null
            ? formatAmountForInput(line.discountValue, invoice.currency, locale)
            : "",
      taxRateId: line.taxRateId ?? "",
      sourceKind: line.sourceKind ?? "",
      sourceId: line.sourceId ?? "",
    })),
  };
}

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const invoice = await getInvoice(ctx, id);
  if (!invoice) notFound();
  const { singular, plural } = ctx.market.documents.invoice;
  const fromQuote = invoice.sourceQuoteId ? (
    <Link href={`/quotes/${invoice.sourceQuoteId}`} className="underline underline-offset-4">
      From an approved quote
    </Link>
  ) : null;

  if (invoice.status === "DRAFT") {
    const [editor, customer] = await Promise.all([
      editorContext(ctx, "invoice", invoice.currency),
      invoice.customerId ? customerForDocumentAction(invoice.customerId) : Promise.resolve(null),
    ]);
    return (
      <>
        <BackLink href="/invoices">{plural}</BackLink>
        <PageHeader
          title={`Draft ${singular.toLowerCase()}`}
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>Changes save as you go.</span>
              {fromQuote}
            </span>
          }
          actions={<StatusBadge kind="invoice" status={invoice.status} />}
        />
        <DocumentEditor
          {...editor}
          kind="invoice"
          documentId={invoice.id}
          actions={{ saveDraft: saveInvoiceDraftAction, deleteDraft: deleteDraftInvoiceAction, send: sendInvoiceAction }}
          number={invoice.number}
          revision={invoice.revision}
          taxMode={invoice.taxMode}
          initialCustomer={customer}
          initial={toEditorState(invoice, ctx.locale)}
        />
      </>
    );
  }

  // An issued invoice is read-only here; editing before payment (D7), void
  // and cancel arrive in 1.7b.
  const view = invoiceDocumentView(invoice, {
    business: await documentBusiness(ctx),
    market: ctx.market,
    locale: ctx.locale,
  });
  const name = `${singular} ${invoice.number ?? ""}`.trim();
  const when = (date: Date | null) =>
    date ? new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeZone: ctx.timezone }).format(date) : null;
  const sentOn = when(invoice.sentAt);
  const viewedOn = when(invoice.viewedAt);

  return (
    <>
      <BackLink href="/invoices">{plural}</BackLink>
      <PageHeader
        title={name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="invoice" status={invoice.status} />
            <span>
              {invoice.customerSnapshot?.displayName}
              {sentOn ? ` · Sent ${sentOn}` : ""}
              {viewedOn ? ` · Opened by the customer ${viewedOn}` : ""}
            </span>
            {fromQuote}
          </span>
        }
        actions={<SentInvoiceActions id={invoice.id} status={invoice.status} shareChannels={ctx.market.shareChannels} />}
      />
      <div className="mt-6 max-w-3xl">
        <DocumentPaper view={view} />
      </div>
    </>
  );
}
