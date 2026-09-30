import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { newQuoteDefaults } from "@/modules/quotes";
import { QuoteEditor } from "../_components/quote-editor";
import { editorContext } from "../_lib/editor-props";

export const metadata: Metadata = { title: "New quote" };

// Nothing is saved until the first change, so opening this page never leaves
// an empty draft behind.
export default async function NewQuotePage() {
  const ctx = await requireOrgContext();
  const defaults = await newQuoteDefaults(ctx);
  const editor = await editorContext(ctx, defaults.currency);

  return (
    <>
      <BackLink href="/quotes">Quotes</BackLink>
      <PageHeader title="New quote" description="Changes save as you go." />
      <QuoteEditor
        {...editor}
        quoteId={null}
        number={null}
        revision={1}
        taxMode={defaults.taxMode}
        initialCustomer={null}
        initial={{
          customerId: "",
          currency: defaults.currency,
          issueDate: defaults.issueDate,
          validUntil: defaults.validUntil,
          notes: defaults.notes,
          terms: defaults.terms,
          lines: [],
        }}
      />
    </>
  );
}
