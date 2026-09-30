import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2Icon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DocumentNumber } from "@/components/document-number";
import { EmptyState } from "@/components/empty-state";
import { ListPager, ListSearch, ListViews, listHref, pageParam } from "@/components/list-controls";
import { MoneyAmount } from "@/components/money-amount";
import { quoteStatusPresentation } from "@/components/status/presentation";
import { StatusBadge } from "@/components/status/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { listQuotes, QUOTE_STATUSES, type QuoteStatus } from "@/modules/quotes";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { normalizeSearch } from "@/shared/text/search";

export const metadata: Metadata = { title: "Quotes" };

const isStatus = (value: unknown): value is QuoteStatus => QUOTE_STATUSES.includes(value as QuoteStatus);

const quotesHref = (q: string | null, status: QuoteStatus | null, page?: number) =>
  listHref("/quotes", { q, status: status?.toLowerCase(), page: page && page > 1 ? page : null });

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = String(params.status ?? "").toUpperCase();
  const status = isStatus(requested) ? requested : null;
  const page = pageParam(params.page);
  const list = await listQuotes(ctx, { search, status: status ?? undefined, page });
  const newQuote = (
    <Link href="/quotes/new" className={buttonVariants()}>
      <FilePlus2Icon aria-hidden="true" />
      New quote
    </Link>
  );

  if (list.total === 0) {
    return (
      <>
        <PageHeader title="Quotes" description="Price out work, send it as a link, and get it approved." />
        <SectionEmpty
          title="No quotes yet"
          description={`Quotes let customers approve work before you start. Send one as a link over ${ctx.market.shareChannels} and they can approve it from their phone, no account needed.`}
          action={{ href: "/quotes/new", label: "New quote", icon: FilePlus2Icon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Price out work, send it as a link, and get it approved."
        actions={newQuote}
      />

      <div className="mt-8 grid gap-3">
        <ListSearch
          action="/quotes"
          label="Search quotes"
          placeholder="Number or customer"
          value={search}
          keep={{ status: status?.toLowerCase() }}
        />
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ListViews
            label="Quotes by status"
            views={[
              { href: quotesHref(search, null), label: "All", current: status === null },
              ...QUOTE_STATUSES.map((s) => ({
                href: quotesHref(search, s),
                label: quoteStatusPresentation[s].label,
                current: status === s,
              })),
            ]}
          />
        </div>
      </div>

      <section aria-label="Quote list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {list.quotes.length === 0 ? (
          <EmptyState
            title={search ? `No quotes match “${search}”` : "No quotes here"}
            description={search ? "Try the quote number or the customer's name." : "Quotes with this status will appear here."}
            action={
              <Link href={quotesHref(null, null)} className={buttonVariants({ variant: "outline" })}>
                Show all quotes
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  href={`/quotes/${quote.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:grid-cols-[8rem_minmax(0,1fr)_auto_auto] sm:px-6"
                >
                  <span className="text-sm">
                    <DocumentNumber number={quote.number} />
                    {quote.revision > 1 && <span className="text-muted-foreground"> · Rev {quote.revision}</span>}
                  </span>
                  <span className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                    <span className="block truncate font-medium">{quote.customerName ?? "No customer yet"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatCalendarDate(quote.issueDate, ctx.locale)}
                    </span>
                  </span>
                  <StatusBadge kind="quote" status={quote.status} className="justify-self-end" />
                  <MoneyAmount
                    amountMinor={quote.totalMinor}
                    currency={quote.currency}
                    locale={ctx.locale}
                    className="row-start-2 justify-self-end font-medium sm:row-start-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => quotesHref(search, status, p)} />
    </>
  );
}
