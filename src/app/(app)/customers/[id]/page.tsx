import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { ArchiveToggle } from "@/components/archive-toggle";
import { PageHeader } from "@/components/app-shell/page-header";
import { SummaryStrip } from "@/components/summary-strip";
import { documentWording } from "@/config/markets";
import { CUSTOMER_FIELDS, type Customer, getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { customerMoney, listInvoices } from "@/modules/invoices";
import { listQuotes } from "@/modules/quotes";
import { todayIn } from "@/shared/dates/calendar";
import { archiveCustomerAction, type CustomerFormValues, restoreCustomerAction } from "../actions";
import { customerFormCopy } from "../_components/customer-copy";
import { CustomerForm } from "../_components/customer-form";
import { RecentDocuments } from "../_components/recent-documents";
import { customerStrip } from "../_lib/record";

export const metadata: Metadata = { title: "Customer" };

/** How many of their latest quotations and billing statements the record shows (the lists have the rest). */
const RECENT = 5;

function toFormValues(customer: Customer): CustomerFormValues {
  return Object.fromEntries(CUSTOMER_FIELDS.map((field) => [field, customer[field] ?? ""])) as CustomerFormValues;
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const customer = await getCustomer(ctx, id);
  if (!customer) notFound();
  const archived = customer.archivedAt !== null;

  // Their money and latest documents: the record, above the details they can edit.
  const [money, quotes, invoices] = await Promise.all([
    customerMoney(ctx, [customer.id], { today: todayIn(ctx.timezone) }),
    listQuotes(ctx, { customerId: customer.id, pageSize: 10 }),
    listInvoices(ctx, { customerId: customer.id, pageSize: 10 }),
  ]);

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
      <SummaryStrip
        label="Customer summary"
        rows={customerStrip({ money, locale: ctx.locale, currency: ctx.currency, market: ctx.market })}
      />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <RecentDocuments
          kind="quote"
          rows={quotes.quotes.slice(0, RECENT)}
          total={quotes.matching}
          customerId={customer.id}
          locale={ctx.locale}
          market={ctx.market}
          canCreate={!archived}
        />
        <RecentDocuments
          kind="invoice"
          rows={invoices.invoices.slice(0, RECENT)}
          total={invoices.matching}
          customerId={customer.id}
          locale={ctx.locale}
          market={ctx.market}
          canCreate={!archived}
        />
      </div>
      <div className="mt-10 max-w-3xl">
        <CustomerForm customerId={customer.id} initialValues={toFormValues(customer)} copy={customerFormCopy(ctx)} />
      </div>
    </>
  );
}
