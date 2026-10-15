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
import { requireOrgContext } from "@/modules/identity";
import { listSuppliers, type SupplierStatus } from "@/modules/purchasing";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { SupplierListSkeleton, supplierColumns, supplierSummary } from "../_components/supplier-list";

export const metadata: Metadata = { title: "Suppliers" };

const suppliersHref = (q: string | null, status: SupplierStatus, size: number) =>
  listHref("/suppliers", { q, status: status === "archived" ? "archived" : null, size: sizeParam(size) });

export default async function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const status: SupplierStatus = params.status === "archived" ? "archived" : "active";
  const page = pageParam(params.page);
  const list = await listSuppliers(ctx, { search, status, page, pageSize: parsePageSize(params.size) });

  // Brand-new business: nothing to search or filter yet.
  if (list.matching === 0 && !search && status === "active" && list.archivedCount === 0) {
    return (
      <>
        <PageHeader title="Suppliers" description="The businesses and people you buy from." />
        <SectionEmpty
          title="No suppliers yet"
          description="Add a supplier to start writing purchase orders. Their details fill in automatically on every one."
          action={{ href: "/suppliers/new", label: "Add supplier", icon: UserPlusIcon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="The businesses and people you buy from."
        actions={
          <Link href="/suppliers/new" className={buttonVariants()}>
            <UserPlusIcon aria-hidden="true" />
            Add supplier
          </Link>
        }
      />

      <ListPending>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ListSearch
            action="/suppliers"
            label="Search suppliers"
            placeholder="Name, contact, email or phone"
            value={search}
            keep={{ status: status === "archived" ? "archived" : undefined, size: keptSize(list.pageSize) }}
          />
          {(list.archivedCount > 0 || status === "archived") && (
            <ListViews
              label="Supplier lists"
              views={[
                { href: suppliersHref(search, "active", list.pageSize), label: "Active", current: status === "active" },
                {
                  href: suppliersHref(search, "archived", list.pageSize),
                  label: `Archived (${list.archivedCount})`,
                  current: status === "archived",
                },
              ]}
            />
          )}
        </div>

        <ListResults label="Loading suppliers" skeleton={<SupplierListSkeleton />}>
          {list.suppliers.length === 0 ? (
            <section aria-label="Supplier list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No suppliers match “${search}”` : "No archived suppliers"}
                description={
                  search
                    ? "Check the spelling, or search by contact, email or phone instead."
                    : "Suppliers you archive appear here."
                }
                action={
                  search && (
                    <Link href={suppliersHref(null, status, list.pageSize)} className={buttonVariants({ variant: "outline" })}>
                      Clear search
                    </Link>
                  )
                }
              />
            </section>
          ) : (
            <DataTable
              label="Supplier list"
              columns={supplierColumns()}
              rows={list.suppliers}
              rowKey={(supplier) => supplier.id}
              rowHref={(supplier) => `/suppliers/${supplier.id}` as Route}
              phoneSummary={supplierSummary}
              meta={list}
              noun={{ singular: "supplier", plural: "suppliers" }}
              hrefFor={pagedHref("/suppliers", { q: search, status: status === "archived" ? "archived" : null }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
