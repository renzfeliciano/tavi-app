import type { Metadata, Route } from "next";
import Link from "next/link";
import { PackagePlusIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { listPurchaseOrders } from "@/modules/purchasing";
import { PO_STATUSES, type PurchaseOrderStatus } from "@/modules/purchasing/client";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { OrderListSkeleton, orderColumns, orderSummary } from "../_components/order-list";

export const metadata: Metadata = { title: "Purchase orders" };

const isStatus = (value: unknown): value is PurchaseOrderStatus => PO_STATUSES.includes(value as PurchaseOrderStatus);

const VIEW_LABELS: Record<PurchaseOrderStatus, string> = { DRAFT: "Draft", ISSUED: "Issued", RECEIVED: "Received", CANCELLED: "Cancelled" };

// Purchase orders to suppliers, newest first. They feed nothing else, so the list has no totals strip.
export default async function PurchaseOrdersPage({ searchParams }: PageProps<"/purchase-orders">) {
  const ctx = await requireOrgContext();
  const { market } = ctx;
  const plural = market.documents.purchaseOrder.plural;
  const noun = { singular: market.documents.purchaseOrder.singular.toLowerCase(), plural: plural.toLowerCase() };
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = isStatus(requested) ? requested : undefined;
  const canWrite = can(ctx, "purchasing.write");
  const list = await listPurchaseOrders(ctx, { search, status, page: pageParam(params.page), pageSize: parsePageSize(params.size) });

  const description = "What you've ordered from your suppliers, and whether it arrived.";
  const suppliersLink = (
    <Link href={"/suppliers" as Route} className={buttonVariants({ variant: "outline" })}>
      <UsersIcon aria-hidden="true" />
      Suppliers
    </Link>
  );
  const actions = (
    <>
      {suppliersLink}
      {canWrite && (
        <Link href={"/purchase-orders/new" as Route} className={buttonVariants()}>
          <PackagePlusIcon aria-hidden="true" />
          New {noun.singular}
        </Link>
      )}
    </>
  );

  if (list.total === 0) {
    return (
      <>
        <PageHeader title={plural} description={description} actions={suppliersLink} />
        <SectionEmpty
          title={`No ${noun.plural} yet`}
          description="Write one to a supplier, issue it to give it a number, then email or download it. Mark it received when the goods arrive."
          action={canWrite ? { href: "/purchase-orders/new" as Route, label: `New ${noun.singular}`, icon: PackagePlusIcon } : undefined}
        />
      </>
    );
  }

  const href = (q: string | null, to: PurchaseOrderStatus | null) => listHref("/purchase-orders", { q, status: to, size: sizeParam(list.pageSize) });
  const views: { to: PurchaseOrderStatus | null; label: string }[] = [
    { to: null, label: "All" },
    ...PO_STATUSES.map((to) => ({ to, label: VIEW_LABELS[to] })),
  ];

  return (
    <>
      <PageHeader title={plural} description={description} actions={actions} />
      <ListPending>
        <div className="mt-5 grid gap-3">
          <ListSearch
            action="/purchase-orders"
            label={`Search ${noun.plural}`}
            placeholder="Supplier or number"
            value={search}
            keep={{ status: status ?? undefined, size: keptSize(list.pageSize) }}
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ListViews
              label={`${plural} by status`}
              views={views.map(({ to, label }) => ({ href: href(search, to), label, current: (status ?? null) === to }))}
            />
          </div>
        </div>

        <ListResults label={`Loading ${noun.plural}`} skeleton={<OrderListSkeleton />}>
          {list.orders.length === 0 ? (
            <section aria-label="Purchase order list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No ${noun.plural} match “${search}”` : "Nothing here"}
                description={search ? "Try the supplier's name or the number." : `No ${noun.plural} with this status yet.`}
                action={
                  <Link href={href(null, null)} className={buttonVariants({ variant: "outline" })}>
                    {search ? "Clear search" : `Show all ${noun.plural}`}
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label="Purchase order list"
              columns={orderColumns(ctx.locale)}
              rows={list.orders}
              rowKey={(order) => order.id}
              rowHref={(order) => `/purchase-orders/${order.id}` as Route}
              phoneSummary={orderSummary(ctx.locale)}
              controls={2}
              meta={list}
              noun={noun}
              hrefFor={pagedHref("/purchase-orders", { q: search, status: status ?? null }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
