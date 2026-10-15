import type { Metadata } from "next";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireOrgContext } from "@/modules/identity";
import { supplierFormCopy } from "../_components/supplier-copy";
import { EMPTY_SUPPLIER, SupplierForm } from "../_components/supplier-form";

export const metadata: Metadata = { title: "Add supplier" };

export default async function NewSupplierPage() {
  const ctx = await requireOrgContext();
  return (
    <>
      <BackLink href="/suppliers">Suppliers</BackLink>
      <PageHeader title="Add supplier" description="Only the name is needed now. Add the rest whenever you have it." />
      <div className="mt-8 max-w-3xl">
        <SupplierForm initialValues={EMPTY_SUPPLIER} copy={supplierFormCopy(ctx)} />
      </div>
    </>
  );
}
