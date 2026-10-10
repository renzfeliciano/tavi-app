import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { newQuoteDefaults } from "@/modules/quotes";
import { DocumentEditor } from "../../_documents/document-editor";
import { editorContext } from "../../_documents/editor-props";
import { deleteDraftQuoteAction, saveQuoteDraftAction, sendQuoteAction } from "../actions";

export const metadata: Metadata = { title: "New quote" };

// Nothing is saved until the first change, so opening this page never leaves
// an empty draft behind.
export default async function NewQuotePage() {
  const ctx = await requireOrgContext();
  const defaults = await newQuoteDefaults(ctx);
  const editor = await editorContext(ctx, "quote", defaults.currency);
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
        initialCustomer={null}
        initial={{
          customerId: "",
          currency: defaults.currency,
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
