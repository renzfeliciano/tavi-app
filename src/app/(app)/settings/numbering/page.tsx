import type { Metadata } from "next";
import { can } from "@/modules/authz";
import { getDocumentNumbering } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { NumberingForm } from "./numbering-form";

export const metadata: Metadata = { title: "Document numbers" };

// PH-facing names until the BIR confirms otherwise (D11): never "Official
// Receipt" or "Sales Invoice".
const LABELS = {
  quote: { title: "Quotations", description: "Numbered when you first send one." },
  invoice: { title: "Billing statements", description: "Numbered when you first send one." },
  receipt: {
    title: "Payment acknowledgements",
    description: "Numbered when you record a payment. Not a BIR official receipt.",
  },
} as const;

export default async function NumberingPage() {
  const ctx = await requireOrgContext();
  const numbering = await getDocumentNumbering(ctx);
  const editable = can(ctx, "organization.manage");

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
            title={LABELS[n.kind].title}
            description={LABELS[n.kind].description}
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
