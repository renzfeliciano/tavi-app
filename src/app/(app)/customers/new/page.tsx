import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { customerFormCopy } from "../_components/customer-copy";
import { CustomerForm, EMPTY_CUSTOMER } from "../_components/customer-form";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const ctx = await requireOrgContext();
  return (
    <>
      <BackLink href="/customers">Customers</BackLink>
      <PageHeader
        title="Add customer"
        description="Only the name is needed now. Add the rest whenever you have it."
      />
      <div className="mt-8 max-w-3xl">
        <CustomerForm initialValues={EMPTY_CUSTOMER} copy={customerFormCopy(ctx)} />
      </div>
    </>
  );
}
