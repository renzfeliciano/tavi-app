import type { Metadata, Route } from "next";
import Link from "next/link";
import { UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { documentWording } from "@/config/markets";
import { type CustomerStatus, latestActivity, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { customerMoney, lastInvoiceChanges } from "@/modules/invoices";
import { lastQuoteChanges } from "@/modules/quotes";
import { todayIn } from "@/shared/dates/calendar";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { CustomerListSkeleton, customerColumns, customerSummary } from "../_components/customer-list";
import { customerRows } from "../_lib/figures";

export const metadata: Metadata = { title: "Customers" };

const customersHref = (q: string | null, status: CustomerStatus, size: number) =>
  listHref("/customers", { q, status: status === "archived" ? "archived" : null, size: sizeParam(size) });

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const status: CustomerStatus = params.status === "archived" ? "archived" : "active";
  const page = pageParam(params.page);
  const list = await listCustomers(ctx, { search, status, page, pageSize: parsePageSize(params.size) });
  const documents = documentWording(ctx.market).quotesAndInvoices;

  // What each listed customer owes and when anything last happened with them: three small queries over this page only.
  const today = todayIn(ctx.timezone);
  const ids = list.customers.map((customer) => customer.id);
  const [money, invoiceChanges, quoteChanges] = await Promise.all([
    customerMoney(ctx, ids, { today }),
    lastInvoiceChanges(ctx, ids),
    lastQuoteChanges(ctx, ids),
  ]);
  const rows = customerRows({
    customers: list.customers,
    money,
    changes: latestActivity([
      { kind: "invoice", changes: invoiceChanges },
      { kind: "quote", changes: quoteChanges },
    ]),
    timezone: ctx.timezone,
    today,
    locale: ctx.locale,
  });

  // Brand-new business: nothing to search or filter yet.
  if (list.matching === 0 && !search && status === "active" && list.archivedCount === 0) {
    return (
      <>
        <PageHeader title="Customers" description="The people and businesses you work for." />
        <SectionEmpty
          title="No customers yet"
          description={`Add your first customer to start creating ${documents}. Their details fill in automatically on every one.`}
          action={{ href: "/customers/new", label: "Add customer", icon: UserPlusIcon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="The people and businesses you work for."
        actions={
          <Link href="/customers/new" className={buttonVariants()}>
            <UserPlusIcon aria-hidden="true" />
            Add customer
          </Link>
        }
      />

      <ListPending>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ListSearch
            action="/customers"
            label="Search customers"
            placeholder="Name, company, email or phone"
            value={search}
            keep={{ status: status === "archived" ? "archived" : undefined, size: keptSize(list.pageSize) }}
          />
          {(list.archivedCount > 0 || status === "archived") && (
            <ListViews
              label="Customer lists"
              views={[
                { href: customersHref(search, "active", list.pageSize), label: "Active", current: status === "active" },
                {
                  href: customersHref(search, "archived", list.pageSize),
                  label: `Archived (${list.archivedCount})`,
                  current: status === "archived",
                },
              ]}
            />
          )}
        </div>

        <ListResults label="Loading customers" skeleton={<CustomerListSkeleton />}>
          {list.customers.length === 0 ? (
            <section aria-label="Customer list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No customers match “${search}”` : "No archived customers"}
                description={
                  search
                    ? "Check the spelling, or search by company, email or phone instead."
                    : "Customers you archive appear here."
                }
                action={
                  search && (
                    <Link href={customersHref(null, status, list.pageSize)} className={buttonVariants({ variant: "outline" })}>
                      Clear search
                    </Link>
                  )
                }
              />
            </section>
          ) : (
            <DataTable
              label="Customer list"
              columns={customerColumns(ctx.locale, ctx.market)}
              rows={rows}
              rowKey={(customer) => customer.id}
              rowHref={(customer) => `/customers/${customer.id}` as Route}
              phoneSummary={customerSummary}
              meta={list}
              noun={{ singular: "customer", plural: "customers" }}
              hrefFor={pagedHref(
                "/customers",
                { q: search, status: status === "archived" ? "archived" : null },
                list.pageSize,
              )}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
