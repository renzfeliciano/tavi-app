import type { Metadata, Route } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentWording } from "@/config/markets";
import { cn } from "@/lib/utils";
import { type CustomerStatus, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { MAX_SEARCH_LENGTH, normalizeSearch } from "@/shared/text/search";

export const metadata: Metadata = { title: "Customers" };

function customersHref({ q, status, page }: { q?: string | null; status?: CustomerStatus; page?: number }): Route {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status === "archived") params.set("status", "archived");
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return (query ? `/customers?${query}` : "/customers") as Route;
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const status: CustomerStatus = params.status === "archived" ? "archived" : "active";
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const list = await listCustomers(ctx, { search, status, page });
  const documents = documentWording(ctx.market).quotesAndInvoices;

  const addButton = (
    <Link href="/customers/new" className={buttonVariants()}>
      <UserPlusIcon aria-hidden="true" />
      Add customer
    </Link>
  );

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

  const tabs: { status: CustomerStatus; label: string }[] = [
    { status: "active", label: "Active" },
    ...(list.archivedCount > 0 || status === "archived"
      ? [{ status: "archived" as const, label: `Archived (${list.archivedCount})` }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Customers" description="The people and businesses you work for." actions={addButton} />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form role="search" action="/customers" className="relative w-full sm:max-w-sm">
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="customer-search"
            type="search"
            name="q"
            defaultValue={search ?? ""}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Name, company, email or phone"
            className="pl-9"
          />
          {status === "archived" && <input type="hidden" name="status" value="archived" />}
        </form>
        {tabs.length > 1 && (
          <nav aria-label="Customer lists" className="flex gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.status}
                href={customersHref({ q: search, status: tab.status })}
                aria-current={tab.status === status ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground pointer-coarse:py-2.5",
                  tab.status === status && "bg-card text-foreground shadow-xs ring-1 ring-border",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
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
                <Link href={customersHref({ status })} className={buttonVariants({ variant: "outline" })}>
                  Clear search
                </Link>
              )
            }
            expression="curious"
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="grid gap-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{customer.displayName}</span>
                    {customer.company && (
                      <span className="block truncate text-sm text-muted-foreground">{customer.company}</span>
                    )}
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

      {(list.page > 1 || list.hasMore) && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
          {list.page > 1 ? (
            <Link
              href={customersHref({ q: search, status, page: list.page - 1 })}
              className={buttonVariants({ variant: "outline" })}
            >
              <ChevronLeftIcon aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">Page {list.page}</span>
          {list.hasMore ? (
            <Link
              href={customersHref({ q: search, status, page: list.page + 1 })}
              className={buttonVariants({ variant: "outline" })}
            >
              Next
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
