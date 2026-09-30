import type { Metadata } from "next";
import { can } from "@/modules/authz";
import type { MarketProfile } from "@/config/markets";
import { type DocumentKind, getDocumentNumbering } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { NumberingForm } from "./numbering-form";

export const metadata: Metadata = { title: "Document numbers" };

// Document names come from the business's market profile (in PH, non-BIR
// wording until the BIR confirms otherwise, D11).
function labelsFor(market: MarketProfile): Record<DocumentKind, { title: string; description: string }> {
  const { quote, invoice, receipt } = market.documents;
  const disclaimer = receipt.disclaimer ? ` ${receipt.disclaimer}` : "";
  return {
    quote: { title: quote.plural, description: "Numbered when you first send one." },
    invoice: { title: invoice.plural, description: "Numbered when you first send one." },
    receipt: { title: receipt.plural, description: `Numbered when you record a payment.${disclaimer}` },
  };
}

export default async function NumberingPage() {
  const ctx = await requireOrgContext();
  const numbering = await getDocumentNumbering(ctx);
  const editable = can(ctx, "organization.manage");
  const labels = labelsFor(ctx.market);

  return (
    <>
      <SettingsPageHeader
        title="Document numbers"
        description="Choose how your numbers look. They always count up and never repeat, even if you change the format."
      />
      {!editable && <ReadOnlyNotice />}
      <div className="mt-8 grid max-w-3xl gap-4">
        {numbering.map((n) => (
          <NumberingForm
            key={n.kind}
            kind={n.kind}
            title={labels[n.kind].title}
            description={labels[n.kind].description}
            prefix={n.prefix}
            padding={n.padding}
            nextValue={n.nextValue}
            editable={editable}
          />
        ))}
      </div>
    </>
  );
}
