import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ArchiveToggle } from "@/components/archive-toggle";
import { requireOrgContext } from "@/modules/identity";
import { getSupplier, SUPPLIER_FIELDS, type Supplier } from "@/modules/purchasing";
import { archiveSupplierAction, restoreSupplierAction, type SupplierFormValues } from "../actions";
import { supplierFormCopy } from "../_components/supplier-copy";
import { SupplierForm } from "../_components/supplier-form";

export const metadata: Metadata = { title: "Supplier" };

function toFormValues(supplier: Supplier): SupplierFormValues {
  return Object.fromEntries(SUPPLIER_FIELDS.map((field) => [field, supplier[field] ?? ""])) as SupplierFormValues;
}

export default async function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const supplier = await getSupplier(ctx, id);
  if (!supplier) notFound();
  const archived = supplier.archivedAt !== null;

  return (
    <>
      <BackLink href={archived ? "/suppliers?status=archived" : "/suppliers"}>Suppliers</BackLink>
      <PageHeader
        title={supplier.displayName}
        description={
          archived ? (
            <span className="inline-flex items-center gap-1.5">
              <ArchiveIcon aria-hidden="true" className="size-3.5" />
              Archived. Restore to order from them again.
            </span>
          ) : (
            (supplier.contactName ?? "Their details fill in on every purchase order you send them.")
          )
        }
        actions={
          <ArchiveToggle
            name={supplier.displayName}
            archived={archived}
            archivedDescription="Hidden from your supplier list and pickers."
            archive={archiveSupplierAction.bind(null, supplier.id)}
            restore={restoreSupplierAction.bind(null, supplier.id)}
          />
        }
      />
      <div className="mt-8 max-w-3xl">
        <SupplierForm supplierId={supplier.id} initialValues={toFormValues(supplier)} copy={supplierFormCopy(ctx)} />
      </div>
    </>
  );
}
