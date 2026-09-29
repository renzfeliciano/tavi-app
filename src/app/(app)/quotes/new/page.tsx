import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "New quote" };

export default function NewQuotePage() {
  return (
    <>
      <PageHeader title={"New quote"} description={"Customer, line items, dates and terms, with a live preview."} />
      <SectionEmpty
        title={"The quote editor is being built"}
        description={"This is where you'll pick a customer, add line items and send the quote as a link. It arrives in Phase 1.5."}
        action={{ href: "/quotes", label: "Back to quotes" }}
        expression="waiting"
      />
    </>
  );
}
