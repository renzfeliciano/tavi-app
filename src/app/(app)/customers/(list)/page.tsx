import type { Metadata } from "next";
import Link from "next/link";
import { UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { CategoryTile } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { ListPager, ListSearch, ListViews, listHref, pageParam } from "@/components/list-controls";
import { buttonVariants } from "@/components/ui/button";
import { documentWording } from "@/config/markets";
import { type CustomerStatus, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { normalizeSearch } from "@/shared/text/search";

export const metadata: Metadata = { title: "Customers" };

const customersHref = (q: string | null, status: CustomerStatus, page?: number) =>
  listHref("/customers", { q, status: status === "archived" ? "archived" : null, page: page && page > 1 ? page : null });

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const status: CustomerStatus = params.status === "archived" ? "archived" : "active";
  const page = pageParam(params.page);
  const list = await listCustomers(ctx, { search, status, page });
  const documents = documentWording(ctx.market).quotesAndInvoices;

  // Brand-new business: nothing to search or filter yet.
  if (list.customers.length === 0 && !search && status === "active" && page === 1 && list.archivedCount === 0) {
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

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearch
          action="/customers"
          label="Search customers"
          placeholder="Name, company, email or phone"
          value={search}
          keep={{ status: status === "archived" ? "archived" : undefined }}
        />
        {(list.archivedCount > 0 || status === "archived") && (
          <ListViews
            label="Customer lists"
            views={[
              { href: customersHref(search, "active"), label: "Active", current: status === "active" },
              {
                href: customersHref(search, "archived"),
                label: `Archived (${list.archivedCount})`,
                current: status === "archived",
              },
            ]}
          />
        )}
      </div>

      <section aria-label="Customer list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {list.customers.length === 0 ? (
          <EmptyState
            title={search ? `No customers match “${search}”` : "No archived customers"}
            description={
              search
                ? "Check the spelling, or search by company, email or phone instead."
                : "Customers you archive appear here."
            }
            action={
              search && (
                <Link href={customersHref(null, status)} className={buttonVariants({ variant: "outline" })}>
                  Clear search
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="grid gap-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-6"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CategoryTile code={customer.category} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{customer.displayName}</span>
                      {customer.company && (
                        <span className="block truncate text-sm text-muted-foreground">{customer.company}</span>
                      )}
                    </span>
                  </span>
                  <span className="min-w-0 text-sm text-muted-foreground">
                    <span className="block truncate">{customer.email ?? customer.phone ?? "No contact details"}</span>
                    {customer.email && customer.phone && <span className="block truncate">{customer.phone}</span>}
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground sm:block">{customer.city}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => customersHref(search, status, p)} />
    </>
  );
}
