import type { Metadata, Route } from "next";
import Link from "next/link";
import { HandCoinsIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { listReceipts, type ReceiptView } from "@/modules/payments";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { ReceiptListSkeleton, receiptColumns, receiptSummary } from "../_components/receipt-list";

export const metadata: Metadata = { title: "Receipts" };

const VIEWS: readonly ReceiptView[] = ["collection", "acknowledgement", "voided"];
const isView = (value: unknown): value is ReceiptView => VIEWS.includes(value as ReceiptView);

// Receipts for money received that isn't an invoice payment, newest first. A voided receipt stays in the list.
export default async function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  const ctx = await requireOrgContext();
  const { market } = ctx;
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = Array.isArray(params.view) ? params.view[0] : params.view;
  const view = isView(requested) ? requested : undefined;
  const canRecord = can(ctx, "payments.record");
  const list = await listReceipts(ctx, { search, view, page: pageParam(params.page), pageSize: parsePageSize(params.size) });

  const description = "Money you received that isn't an invoice payment.";
  const newReceipt = canRecord && (
    <Link href={"/receipts/new" as Route} className={buttonVariants()}>
      <HandCoinsIcon aria-hidden="true" />
      New receipt
    </Link>
  );

  if (list.total === 0) {
    return (
      <>
        <BackLink href="/payments">Payments</BackLink>
        <PageHeader title="Receipts" description={description} />
        <SectionEmpty
          title="No receipts yet"
          description="A receipt is for money you received that isn't a payment on an invoice, like a reimbursement or a deposit. Make one and it's numbered at once."
          action={canRecord ? { href: "/receipts/new" as Route, label: "New receipt", icon: HandCoinsIcon } : undefined}
        />
      </>
    );
  }

  const href = (q: string | null, to: ReceiptView | null) => listHref("/receipts", { q, view: to, size: sizeParam(list.pageSize) });
  const views: { to: ReceiptView | null; label: string }[] = [
    { to: null, label: "All" },
    { to: "collection", label: market.documents.receiptKinds.collection.title },
    { to: "acknowledgement", label: market.documents.receiptKinds.acknowledgement.title },
    { to: "voided", label: "Voided" },
  ];

  return (
    <>
      <BackLink href="/payments">Payments</BackLink>
      <PageHeader title="Receipts" description={description} actions={newReceipt} />
      <ListPending>
        <div className="mt-5 grid gap-3">
          <ListSearch
            action="/receipts"
            label="Search receipts"
            placeholder="Payer, number or what it was for"
            value={search}
            keep={{ view: view ?? undefined, size: keptSize(list.pageSize) }}
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ListViews
              label="Receipts by kind"
              views={views.map(({ to, label }) => ({ href: href(search, to), label, current: (view ?? null) === to }))}
            />
          </div>
        </div>

        <ListResults label="Loading receipts" skeleton={<ReceiptListSkeleton />}>
          {list.receipts.length === 0 ? (
            <section aria-label="Receipt list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No receipts match “${search}”` : "Nothing here"}
                description={search ? "Try the payer's name, the receipt number or what it was for." : "No receipts of this kind yet."}
                action={
                  <Link href={href(null, null)} className={buttonVariants({ variant: "outline" })}>
                    {search ? "Clear search" : "Show all receipts"}
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label="Receipt list"
              columns={receiptColumns(ctx.locale, market)}
              rows={list.receipts}
              rowKey={(receipt) => receipt.id}
              rowHref={(receipt) => `/receipts/${receipt.id}` as Route}
              phoneSummary={receiptSummary(ctx.locale, market)}
              controls={2}
              meta={list}
              noun={{ singular: "receipt", plural: "receipts" }}
              hrefFor={pagedHref("/receipts", { q: search, view: view ?? null }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
