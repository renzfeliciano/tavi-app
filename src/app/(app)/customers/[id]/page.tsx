import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { documentWording } from "@/config/markets";
import { CUSTOMER_FIELDS, type Customer, getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import type { CustomerFormValues } from "../actions";
import { customerFormCopy } from "../_components/customer-copy";
import { CustomerForm } from "../_components/customer-form";
import { ArchiveToggle } from "./archive-toggle";

export const metadata: Metadata = { title: "Customer" };

function toFormValues(customer: Customer): CustomerFormValues {
  return Object.fromEntries(CUSTOMER_FIELDS.map((field) => [field, customer[field] ?? ""])) as CustomerFormValues;
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const customer = await getCustomer(ctx, id);
  if (!customer) notFound();
  const archived = customer.archivedAt !== null;

  return (
    <>
      <BackLink href={archived ? "/customers?status=archived" : "/customers"}>Customers</BackLink>
      <PageHeader
        title={customer.displayName}
        description={
          archived ? (
            <span className="inline-flex items-center gap-1.5">
              <ArchiveIcon aria-hidden="true" className="size-3.5" />
              Archived. Restore to quote or bill them again.
            </span>
          ) : (
            customer.company ??
            `Their details fill in on every ${documentWording(ctx.market).quoteAndInvoice} you send them.`
          )
        }
        actions={<ArchiveToggle id={customer.id} name={customer.displayName} archived={archived} />}
      />
      <div className="mt-8 max-w-3xl">
        <CustomerForm customerId={customer.id} initialValues={toFormValues(customer)} copy={customerFormCopy(ctx)} />
      </div>
    </>
  );
}
