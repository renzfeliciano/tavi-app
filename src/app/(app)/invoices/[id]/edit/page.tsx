import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, transitionInvoice, canEditIssued, invoiceTitle } from "@/modules/invoices";
import { customerForDocumentAction } from "../../../_documents/actions";
import { DocumentEditor } from "../../../_documents/document-editor";
import { editorContext } from "../../../_documents/editor-props";
import {
  deleteDraftInvoiceAction,
  editIssuedInvoiceAction,
  saveInvoiceDraftAction,
  sendInvoiceAction,
} from "../../actions";
import { toEditorState } from "../../_lib/editor-state";

export const metadata: Metadata = { title: "Edit invoice" };

// Changes to a sent invoice before any payment (D7): customer and currency
// fixed; nothing is saved until "Save changes" is confirmed, and then it's
// the next revision. Anything else goes back to the invoice's page.
export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const invoice = await getInvoice(ctx, id);
  if (!invoice) notFound();
  // Billing statements only: a registered invoice is locked once issued (D14).
  if (!transitionInvoice(invoice.status, "edit").ok || !canEditIssued(invoice)) redirect(`/invoices/${invoice.id}`);

  const [editor, customer] = await Promise.all([
    editorContext(ctx, "invoice", invoice.currency),
    invoice.customerId ? customerForDocumentAction(invoice.customerId) : Promise.resolve(null),
  ]);
  const name = `${invoiceTitle(invoice, ctx.market)} ${invoice.number ?? ""}`.trim();

  return (
    <>
      <BackLink href={`/invoices/${invoice.id}` as Route}>{name}</BackLink>
      <PageHeader
        title={`Edit ${name}`}
        description="The customer and currency stay as sent. Saving makes a new revision on the same link."
      />
      <DocumentEditor
        {...editor}
        // As sent: the payment instructions snapshotted on the invoice.
        paymentInstructions={invoice.paymentInstructions}
        kind="invoice"
        mode="issued"
        documentId={invoice.id}
        actions={{
          saveDraft: saveInvoiceDraftAction,
          deleteDraft: deleteDraftInvoiceAction,
          send: sendInvoiceAction,
          saveIssued: editIssuedInvoiceAction,
        }}
        number={invoice.number}
        revision={invoice.revision}
        taxMode={invoice.taxMode}
        initialCustomer={customer}
        initial={toEditorState(invoice, ctx.locale)}
      />
    </>
  );
}
