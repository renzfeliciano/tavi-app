import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { newQuoteDefaults } from "@/modules/quotes";
import { DocumentEditor } from "../../_documents/document-editor";
import { customerToStartWith } from "../../_documents/editor-customer";
import { editorContext } from "../../_documents/editor-props";
import { deleteDraftQuoteAction, saveQuoteDraftAction, sendQuoteAction } from "../actions";

export const metadata: Metadata = { title: "New quote" };

// Nothing is saved until the first change, so opening this page never leaves
// an empty draft behind.
export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const ctx = await requireOrgContext();
  const customer = await customerToStartWith(ctx, (await searchParams).customer);
  const defaults = await newQuoteDefaults(ctx);
  // Starting from a customer's page: bill in the currency they are billed in, like choosing them in the editor does.
  const currency = customer?.currency ?? defaults.currency;
  const editor = await editorContext(ctx, "quote", currency);
  const { plural } = ctx.market.documents.quote;

  return (
    <>
      <BackLink href="/quotes">{plural}</BackLink>
      <PageHeader title={`New ${editor.title.toLowerCase()}`} description="Changes save as you go." />
      <DocumentEditor
        {...editor}
        kind="quote"
        documentId={null}
        actions={{ saveDraft: saveQuoteDraftAction, deleteDraft: deleteDraftQuoteAction, send: sendQuoteAction }}
        number={null}
        revision={1}
        taxMode={defaults.taxMode}
        initialCustomer={customer}
        initial={{
          customerId: customer?.id ?? "",
          currency,
          issueDate: defaults.issueDate,
          endDate: defaults.validUntil,
          notes: defaults.notes,
          terms: defaults.terms,
          lines: [],
        }}
      />
    </>
  );
}
