import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title={"Add customer"} description={"Name, contact details and billing address."} />
      <SectionEmpty
        title={"The customer form is being built"}
        description={"You'll save a customer's details once, and they'll fill in on every quote and invoice. It arrives in Phase 1.2."}
        action={{ href: "/customers", label: "Back to customers" }}
        expression="waiting"
      />
    </>
  );
}
