import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { newInvoiceDefaults } from "@/modules/invoices";
import { DocumentEditor } from "../../_documents/document-editor";
import { customerToStartWith } from "../../_documents/editor-customer";
import { editorContext } from "../../_documents/editor-props";
import { deleteDraftInvoiceAction, saveInvoiceDraftAction, sendInvoiceAction } from "../actions";
import { EMPTY_QUALIFIED_DISCOUNT } from "@/modules/invoices/client";

export const metadata: Metadata = { title: "New invoice" };

// Nothing is saved until the first change, so opening this page never leaves
// an empty draft behind.
export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const ctx = await requireOrgContext();
  const customer = await customerToStartWith(ctx, (await searchParams).customer);
  const defaults = await newInvoiceDefaults(ctx);
  // Starting from a customer's page: bill in the currency they are billed in, like choosing them in the editor does.
  const currency = customer?.currency ?? defaults.currency;
  const editor = await editorContext(ctx, "invoice", currency);
  const { plural } = ctx.market.documents.invoice;

  return (
    <>
      <BackLink href="/invoices">{plural}</BackLink>
      <PageHeader title={`New ${editor.title.toLowerCase()}`} description="Changes save as you go." />
      <DocumentEditor
        {...editor}
        kind="invoice"
        documentId={null}
        actions={{ saveDraft: saveInvoiceDraftAction, deleteDraft: deleteDraftInvoiceAction, send: sendInvoiceAction }}
        number={null}
        revision={1}
        taxMode={defaults.taxMode}
        initialCustomer={customer}
        initial={{
          customerId: customer?.id ?? "",
          currency,
          issueDate: defaults.issueDate,
          endDate: defaults.dueDate,
          notes: defaults.notes,
          terms: defaults.terms,
          lines: [],
          qualifiedDiscount: EMPTY_QUALIFIED_DISCOUNT,
        }}
      />
    </>
  );
}
