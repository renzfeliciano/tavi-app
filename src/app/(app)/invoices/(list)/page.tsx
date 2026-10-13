import type { Metadata, Route } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { SummaryStrip } from "@/components/summary-strip";
import { invoiceStatusPresentation } from "@/components/status/presentation";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { INVOICE_STATUSES, type InvoiceStatus, invoiceMoneySummary, invoicePipeline, listInvoices } from "@/modules/invoices";
import { todayIn } from "@/shared/dates/calendar";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { InvoiceListSkeleton, invoiceColumns, invoiceSummary } from "../../_documents/document-list";
import { invoiceStrip } from "../../_documents/summary";

export const metadata: Metadata = { title: "Invoices" };

const isStatus = (value: unknown): value is InvoiceStatus => INVOICE_STATUSES.includes(value as InvoiceStatus);

const invoicesHref = (q: string | null, status: InvoiceStatus | null, size: number) =>
  listHref("/invoices", { q, status: status?.toLowerCase(), size: sizeParam(size) });

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = String(params.status ?? "").toUpperCase();
  const status = isStatus(requested) ? requested : null;
  const page = pageParam(params.page);
  const today = todayIn(ctx.timezone);
  const [list, money, pipeline] = await Promise.all([
    listInvoices(ctx, { search, status: status ?? undefined, page, pageSize: parsePageSize(params.size) }),
    invoiceMoneySummary(ctx, { today }),
    invoicePipeline(ctx, { today }),
  ]);
  const { singular, plural } = ctx.market.documents.invoice;
  const strip = invoiceStrip({ money, drafts: pipeline.drafts, names: ctx.market.documents.invoice, today, locale: ctx.locale, currency: ctx.currency });
  const description = "Bill for finished work and see what's paid, due and overdue.";
  const newLabel = `New ${singular.toLowerCase()}`;

  if (list.total === 0) {
    return (
      <>
        <PageHeader title={plural} description={description} />
        <SectionEmpty
          title={`No ${plural.toLowerCase()} yet`}
          description={`Create one for finished work, or turn an approved quote into one in a tap. Send it as a link over ${ctx.market.shareChannels}, with your payment details on it.`}
          action={{ href: "/invoices/new", label: newLabel, icon: ReceiptTextIcon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={plural}
        description={description}
        actions={
          <Link href="/invoices/new" className={buttonVariants()}>
            <ReceiptTextIcon aria-hidden="true" />
            {newLabel}
          </Link>
        }
      />

      <SummaryStrip label={`${singular} summary`} rows={strip} />

      <ListPending>
        <div className="mt-5 grid gap-3">
          <ListSearch
            action="/invoices"
            label={`Search ${plural.toLowerCase()}`}
            placeholder="Number or customer"
            value={search}
            keep={{ status: status?.toLowerCase(), size: keptSize(list.pageSize) }}
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ListViews
              label={`${plural} by status`}
              views={[
                { href: invoicesHref(search, null, list.pageSize), label: "All", current: status === null },
                ...INVOICE_STATUSES.map((s) => ({
                  href: invoicesHref(search, s, list.pageSize),
                  label: invoiceStatusPresentation[s].label,
                  current: status === s,
                })),
              ]}
            />
          </div>
        </div>

        <ListResults label={`Loading ${plural.toLowerCase()}`} skeleton={<InvoiceListSkeleton label={`${singular} list`} />}>
          {list.invoices.length === 0 ? (
            <section aria-label={`${singular} list`} className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `Nothing matches “${search}”` : "Nothing here"}
                description={search ? "Try the number or the customer's name." : `${plural} with this status will appear here.`}
                action={
                  <Link href={invoicesHref(null, null, list.pageSize)} className={buttonVariants({ variant: "outline" })}>
                    Show all
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label={`${singular} list`}
              columns={invoiceColumns(ctx.locale)}
              rows={list.invoices}
              rowKey={(invoice) => invoice.id}
              rowHref={(invoice) => `/invoices/${invoice.id}` as Route}
              phoneSummary={invoiceSummary(ctx.locale)}
              controls={2}
              strip
              meta={list}
              noun={{ singular: singular.toLowerCase(), plural: plural.toLowerCase() }}
              hrefFor={pagedHref("/invoices", { q: search, status: status?.toLowerCase() }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
