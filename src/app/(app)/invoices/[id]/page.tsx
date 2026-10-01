import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentPaper } from "@/components/document/document-paper";
import { StatusBadge } from "@/components/status/status-badge";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice } from "@/modules/invoices";
import { customerForDocumentAction } from "../../_documents/actions";
import { DocumentEditor } from "../../_documents/document-editor";
import { documentBusiness, editorContext } from "../../_documents/editor-props";
import { deleteDraftInvoiceAction, saveInvoiceDraftAction, sendInvoiceAction } from "../actions";
import { SentInvoiceActions } from "../_components/sent-invoice-actions";
import { toEditorState } from "../_lib/editor-state";
import { invoiceDocumentView } from "../_lib/invoice-view";

export const metadata: Metadata = { title: "Invoice" };

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

  // An issued invoice is read-only here; edits (before payment, D7) happen on
  // its edit page, and void / cancel ask for a reason.
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
  const editedOn = when(invoice.editedAt);
  const closedNote =
    invoice.status === "VOID"
      ? `Voided${when(invoice.voidedAt) ? ` ${when(invoice.voidedAt)}` : ""}: ${invoice.voidReason ?? ""}`
      : invoice.status === "CANCELLED"
        ? `Cancelled${when(invoice.cancelledAt) ? ` ${when(invoice.cancelledAt)}` : ""}: ${invoice.cancelReason ?? ""}`
        : null;

  return (
    <>
      <BackLink href="/invoices">{plural}</BackLink>
      <PageHeader
        title={invoice.revision > 1 ? `${name} · Rev ${invoice.revision}` : name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="invoice" status={invoice.status} />
            <span>
              {invoice.customerSnapshot?.displayName}
              {sentOn ? ` · Sent ${sentOn}` : ""}
              {viewedOn ? ` · Opened by the customer ${viewedOn}` : ""}
              {editedOn ? ` · Updated ${editedOn}` : ""}
            </span>
            {fromQuote}
          </span>
        }
        actions={
          <SentInvoiceActions
            id={invoice.id}
            status={invoice.status}
            name={name}
            amountPaidMinor={invoice.amountPaidMinor}
            canVoid={can(ctx, "invoices.void")}
            shareChannels={ctx.market.shareChannels}
          />
        }
      />
      {closedNote && (
        <p role="status" className="mt-4 max-w-3xl rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
          {closedNote}
        </p>
      )}
      <div className="mt-6 max-w-3xl">
        <DocumentPaper view={view} />
      </div>
    </>
  );
}
