import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentPaper } from "@/components/document/document-paper";
import { StatusBadge } from "@/components/status/status-badge";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, invoiceTitle, isPayable } from "@/modules/invoices";
import { listInvoicePayments, paymentProofRows, paymentWithholdingStatus } from "@/modules/payments";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { customerForDocumentAction } from "../../../_documents/actions";
import { DocumentEditor } from "../../../_documents/document-editor";
import { documentBusiness, editorContext } from "../../../_documents/editor-props";
import { DOCUMENT_BODY, DocumentSidePanel, panelPlace } from "../../../_documents/side-panel";
import { deleteDraftInvoiceAction, saveInvoiceDraftAction, sendInvoiceAction } from "../../actions";
import { InvoicePayments } from "../../_components/invoice-payments";
import { SentInvoiceActions } from "../../_components/sent-invoice-actions";
import { toEditorState } from "../../_lib/editor-state";
import { invoiceDocumentView } from "../../_lib/invoice-view";
import { invoicePanel } from "../../_lib/panel";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const invoice = await getInvoice(ctx, id);
  if (!invoice) notFound();
  const { plural } = ctx.market.documents.invoice;
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
          title={`Draft ${editor.title.toLowerCase()}`}
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
    business: await documentBusiness(ctx, invoice.sellerSnapshot),
    market: ctx.market,
    locale: ctx.locale,
  });
  const name = `${invoiceTitle(invoice, ctx.market)} ${invoice.number ?? ""}`.trim();
  const today = todayIn(ctx.timezone);
  const panel = invoicePanel(invoice, {
    today,
    locale: ctx.locale,
    timezone: ctx.timezone,
    quoteTitle: ctx.market.documents.quote.singular,
  });
  // A voided or cancelled statement takes no more payments, so its payments card is gone.
  const hasPayments = invoice.status !== "VOID" && invoice.status !== "CANCELLED";
  // The payments, and where each one's withheld tax stands on its 2307: one query for all of them.
  const invoicePayments = hasPayments ? await listInvoicePayments(ctx, invoice.id) : [];
  const withholding = ctx.market.taxWithheld
    ? await paymentWithholdingStatus(ctx, invoicePayments.filter((p) => p.withheldMinor > 0).map((p) => p.id))
    : new Map<string, never>();

  return (
    <>
      <BackLink href="/invoices">{plural}</BackLink>
      <PageHeader
        title={invoice.revision > 1 ? `${name} · Rev ${invoice.revision}` : name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="invoice" status={invoice.status} />
            <span>{invoice.customerSnapshot?.displayName}</span>
          </span>
        }
        actions={
          <SentInvoiceActions
            id={invoice.id}
            status={invoice.status}
            name={name}
            amountPaidMinor={invoice.amountPaidMinor}
            registered={invoice.registration !== null}
            printed={invoice.printCount > 0}
            eInvoice={invoice.registration !== null && can(ctx, "reports.read")}
            canVoid={can(ctx, "invoices.void")}
            shareChannels={ctx.market.shareChannels}
            reminder={
              invoice.totalMinor > invoice.amountPaidMinor
                ? {
                    customerName: invoice.customerSnapshot?.displayName ?? null,
                    businessName: view.business.name,
                    balanceMinor: invoice.totalMinor - invoice.amountPaidMinor,
                    currency: invoice.currency,
                    locale: ctx.locale,
                    dueDate: invoice.dueDate,
                    today,
                  }
                : null
            }
          />
        }
      />
      <div className={DOCUMENT_BODY}>
        {hasPayments && (
          <InvoicePayments
            invoiceId={invoice.id}
            name={name}
            currency={invoice.currency}
            locale={ctx.locale}
            today={today}
            balanceMinor={invoice.totalMinor - invoice.amountPaidMinor}
            payable={isPayable(invoice.status)}
            canRecord={can(ctx, "payments.record")}
            canVoid={can(ctx, "payments.void")}
            customerEmail={invoice.customerSnapshot?.email ?? null}
            methodLabels={ctx.market.paymentMethodLabels}
            detailLabels={ctx.market.paymentDetailLabels}
            detailExamples={ctx.market.paymentDetailExamples}
            chequeDateLabel={ctx.market.chequeDateLabel}
            taxWithheld={ctx.market.taxWithheld}
            receiptTitle={ctx.market.documents.receipt.singular}
            payments={invoicePayments.map((p) => ({
              id: p.id,
              receiptNumber: p.receiptNumber,
              paidOn: p.paidOn,
              method: p.method,
              details: paymentProofRows(p, ctx.market, (date) => formatCalendarDate(date, ctx.locale)),
              amountMinor: p.amountMinor,
              withheldMinor: p.withheldMinor,
              withholding: withholding.get(p.id),
              voidReason: p.voidReason,
            }))}
          />
        )}
        <DocumentSidePanel
          label={`${ctx.market.documents.invoice.singular} details`}
          data={panel}
          className={panelPlace(hasPayments ? 2 : 1)}
        />
        <div className="min-w-0">
          <DocumentPaper view={view} />
        </div>
      </div>
    </>
  );
}
