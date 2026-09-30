import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { newInvoiceDefaults } from "@/modules/invoices";
import { DocumentEditor } from "../../_documents/document-editor";
import { editorContext } from "../../_documents/editor-props";
import { deleteDraftInvoiceAction, saveInvoiceDraftAction, sendInvoiceAction } from "../actions";

export const metadata: Metadata = { title: "New invoice" };

// Nothing is saved until the first change, so opening this page never leaves
// an empty draft behind.
export default async function NewInvoicePage() {
  const ctx = await requireOrgContext();
  const defaults = await newInvoiceDefaults(ctx);
  const editor = await editorContext(ctx, "invoice", defaults.currency);
  const { singular, plural } = ctx.market.documents.invoice;

  return (
    <>
      <BackLink href="/invoices">{plural}</BackLink>
      <PageHeader title={`New ${singular.toLowerCase()}`} description="Changes save as you go." />
      <DocumentEditor
        {...editor}
        kind="invoice"
        documentId={null}
        actions={{ saveDraft: saveInvoiceDraftAction, deleteDraft: deleteDraftInvoiceAction, send: sendInvoiceAction }}
        number={null}
        revision={1}
        taxMode={defaults.taxMode}
        initialCustomer={null}
        initial={{
          customerId: "",
          currency: defaults.currency,
          issueDate: defaults.issueDate,
          endDate: defaults.dueDate,
          notes: defaults.notes,
          terms: defaults.terms,
          lines: [],
        }}
      />
    </>
  );
}
