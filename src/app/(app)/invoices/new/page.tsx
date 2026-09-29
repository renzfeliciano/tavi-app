import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader title={"New invoice"} description={"Bill for finished work."} />
      <SectionEmpty
        title={"The invoice editor is being built"}
        description={"You'll create invoices here, or convert an approved quote in one tap. It arrives in Phase 1.7."}
        action={{ href: "/invoices", label: "Back to invoices" }}
        expression="waiting"
      />
    </>
  );
}
