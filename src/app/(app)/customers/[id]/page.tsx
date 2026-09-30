import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { ArchiveToggle } from "@/components/archive-toggle";
import { PageHeader } from "@/components/app-shell/page-header";
import { documentWording } from "@/config/markets";
import { CUSTOMER_FIELDS, type Customer, getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { archiveCustomerAction, type CustomerFormValues, restoreCustomerAction } from "../actions";
import { customerFormCopy } from "../_components/customer-copy";
import { CustomerForm } from "../_components/customer-form";

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
        actions={
          <ArchiveToggle
            name={customer.displayName}
            archived={archived}
            archivedDescription="Hidden from your customer list and pickers."
            archive={archiveCustomerAction.bind(null, customer.id)}
            restore={restoreCustomerAction.bind(null, customer.id)}
          />
        }
      />
      <div className="mt-8 max-w-3xl">
        <CustomerForm customerId={customer.id} initialValues={toFormValues(customer)} copy={customerFormCopy(ctx)} />
      </div>
    </>
  );
}
