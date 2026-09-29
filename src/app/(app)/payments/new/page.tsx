import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Record payment" };

export default function RecordPaymentPage() {
  return (
    <>
      <PageHeader title={"Record payment"} description={"Mark money you've received against an invoice."} />
      <SectionEmpty
        title={"Recording payments is being built"}
        description={"Pick an invoice, enter the amount, date and method, and the balance updates itself. It arrives in Phase 1.8."}
        action={{ href: "/payments", label: "Back to payments" }}
        expression="waiting"
      />
    </>
  );
}
