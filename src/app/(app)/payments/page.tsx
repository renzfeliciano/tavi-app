import type { Metadata } from "next";
import { BanknoteIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title={"Payments"} description={"Money you've received, across all invoices."} />
      <SectionEmpty
        title={"No payments recorded yet"}
        description={"When a customer pays by bank transfer, GCash, Maya, cash or card, record it here. The invoice updates itself."}
        action={{ href: "/payments/new", label: "Record payment", icon: BanknoteIcon }}
      />
    </>
  );
}
