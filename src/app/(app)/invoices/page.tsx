import type { Metadata } from "next";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title={"Invoices"} description={"Bill for finished work and see what's paid, due and overdue."} />
      <SectionEmpty
        title={"No invoices yet"}
        description={"Invoices appear here when you bill finished work or convert an approved quote. You'll always see what's paid, what's due and what's overdue."}
        action={{ href: "/invoices/new", label: "New invoice", icon: ReceiptTextIcon }}
      />
    </>
  );
}
