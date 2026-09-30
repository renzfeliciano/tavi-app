import type { Metadata } from "next";
import { BanknoteIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { requireOrgContext } from "@/modules/identity";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const { market } = await requireOrgContext();
  return (
    <>
      <PageHeader title={"Payments"} description={"Money you've received, across all invoices."} />
      <SectionEmpty
        title={"No payments recorded yet"}
        description={`When a customer pays by ${market.paymentMethods}, record it here. The ${market.documents.invoice.singular.toLowerCase()} updates itself.`}
        action={{ href: "/payments/new", label: "Record payment", icon: BanknoteIcon }}
      />
    </>
  );
}
