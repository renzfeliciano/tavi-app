import type { Metadata, Route } from "next";
import Link from "next/link";
import { FilePlus2Icon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DocumentNumber } from "@/components/document-number";
import { EmptyState } from "@/components/empty-state";
import { ListPager, ListSearch, ListViews, listHref, pageParam } from "@/components/list-controls";
import { DocumentRow } from "../../_documents/document-row";
import { MissingCustomer } from "@/components/missing-customer";
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
  const { singular, plural } = ctx.market.documents.quote;
  const description = `Price out work, send it as a link, and get it approved.`;
  const newLabel = `New ${singular.toLowerCase()}`;
  const newQuote = (
    <Link href="/quotes/new" className={buttonVariants()}>
      <FilePlus2Icon aria-hidden="true" />
      {newLabel}
    </Link>
  );

  if (list.total === 0) {
    return (
      <>
        <PageHeader title={plural} description={description} />
        <SectionEmpty
          title={`No ${plural.toLowerCase()} yet`}
          description={`${plural} let customers approve work before you start. Send one as a link over ${ctx.market.shareChannels} and they can approve it from their phone, no account needed.`}
          action={{ href: "/quotes/new", label: newLabel, icon: FilePlus2Icon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={plural}
        description={description}
        actions={newQuote}
      />

      <div className="mt-8 grid gap-3">
        <ListSearch
          action="/quotes"
          label={`Search ${ctx.market.documents.quote.plural.toLowerCase()}`}
          placeholder="Number or customer"
          value={search}
          keep={{ status: status?.toLowerCase() }}
        />
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ListViews
            label={`${ctx.market.documents.quote.plural} by status`}
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

      <section aria-label={`${ctx.market.documents.quote.singular} list`} className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {list.quotes.length === 0 ? (
          <EmptyState
            title={search ? `No ${ctx.market.documents.quote.plural.toLowerCase()} match “${search}”` : `No ${ctx.market.documents.quote.plural.toLowerCase()} here`}
            description={search ? "Try the number or the customer's name." : "Nothing has this status yet."}
            action={
              <Link href={quotesHref(null, null)} className={buttonVariants({ variant: "outline" })}>
                Show all {ctx.market.documents.quote.plural.toLowerCase()}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.quotes.map((quote) => (
              <li key={quote.id}>
                <DocumentRow
                  href={`/quotes/${quote.id}` as Route}
                  customer={quote.customerName ?? <MissingCustomer />}
                  meta={
                    <>
                      {quote.number !== null && <DocumentNumber number={quote.number} />}
                      {quote.revision > 1 && <span>Rev {quote.revision}</span>}
                      <span>{formatCalendarDate(quote.issueDate, ctx.locale)}</span>
                    </>
                  }
                  status={<StatusBadge kind="quote" status={quote.status} />}
                  amount={<MoneyAmount amountMinor={quote.totalMinor} currency={quote.currency} locale={ctx.locale} />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => quotesHref(search, status, p)} />
    </>
  );
}
