import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Products & Services" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader title={"Products & Services"} description={"What you sell, with your usual prices."} />
      <SectionEmpty
        title={"Nothing saved yet"}
        description={"Save the products and services you sell with their usual price, so adding them to a quote takes one tap. This list arrives with the catalog step (Phase 1.3)."}
        expression="waiting"
      />
    </>
  );
}
