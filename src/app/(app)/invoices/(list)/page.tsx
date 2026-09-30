import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DocumentNumber } from "@/components/document-number";
import { EmptyState } from "@/components/empty-state";
import { ListPager, ListSearch, ListViews, listHref, pageParam } from "@/components/list-controls";
import { MoneyAmount } from "@/components/money-amount";
import { invoiceStatusPresentation } from "@/components/status/presentation";
import { StatusBadge } from "@/components/status/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { INVOICE_STATUSES, type InvoiceStatus, listInvoices } from "@/modules/invoices";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { normalizeSearch } from "@/shared/text/search";

export const metadata: Metadata = { title: "Invoices" };

const isStatus = (value: unknown): value is InvoiceStatus => INVOICE_STATUSES.includes(value as InvoiceStatus);

const invoicesHref = (q: string | null, status: InvoiceStatus | null, page?: number) =>
  listHref("/invoices", { q, status: status?.toLowerCase(), page: page && page > 1 ? page : null });

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = String(params.status ?? "").toUpperCase();
  const status = isStatus(requested) ? requested : null;
  const page = pageParam(params.page);
  const list = await listInvoices(ctx, { search, status: status ?? undefined, page });
  const { singular, plural } = ctx.market.documents.invoice;
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

      <div className="mt-8 grid gap-3">
        <ListSearch
          action="/invoices"
          label={`Search ${plural.toLowerCase()}`}
          placeholder="Number or customer"
          value={search}
          keep={{ status: status?.toLowerCase() }}
        />
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ListViews
            label={`${plural} by status`}
            views={[
              { href: invoicesHref(search, null), label: "All", current: status === null },
              ...INVOICE_STATUSES.map((s) => ({
                href: invoicesHref(search, s),
                label: invoiceStatusPresentation[s].label,
                current: status === s,
              })),
            ]}
          />
        </div>
      </div>

      <section aria-label={`${singular} list`} className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {list.invoices.length === 0 ? (
          <EmptyState
            title={search ? `Nothing matches “${search}”` : "Nothing here"}
            description={search ? "Try the number or the customer's name." : `${plural} with this status will appear here.`}
            action={
              <Link href={invoicesHref(null, null)} className={buttonVariants({ variant: "outline" })}>
                Show all
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:grid-cols-[8rem_minmax(0,1fr)_auto_auto] sm:px-6"
                >
                  <span className="text-sm">
                    <DocumentNumber number={invoice.number} />
                  </span>
                  <span className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                    <span className="block truncate font-medium">{invoice.customerName ?? "No customer yet"}</span>
                    <span className="block text-sm text-muted-foreground">
                      Due {formatCalendarDate(invoice.dueDate, ctx.locale)}
                    </span>
                  </span>
                  <StatusBadge kind="invoice" status={invoice.status} className="justify-self-end" />
                  <MoneyAmount
                    amountMinor={invoice.totalMinor}
                    currency={invoice.currency}
                    locale={ctx.locale}
                    className="row-start-2 justify-self-end font-medium sm:row-start-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => invoicesHref(search, status, p)} />
    </>
  );
}
