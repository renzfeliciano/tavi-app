import type { Metadata, Route } from "next";
import Link from "next/link";
import { FilePlus2Icon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { SummaryStrip } from "@/components/summary-strip";
import { quoteStatusPresentation } from "@/components/status/presentation";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { listQuotes, QUOTE_STATUSES, type QuoteStatus, quotePipeline } from "@/modules/quotes";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { QuoteListSkeleton, quoteColumns, quoteSummary } from "../../_documents/document-list";
import { quoteStrip } from "../../_documents/summary";

export const metadata: Metadata = { title: "Quotes" };

const isStatus = (value: unknown): value is QuoteStatus => QUOTE_STATUSES.includes(value as QuoteStatus);

const quotesHref = (q: string | null, status: QuoteStatus | null, size: number) =>
  listHref("/quotes", { q, status: status?.toLowerCase(), size: sizeParam(size) });

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = String(params.status ?? "").toUpperCase();
  const status = isStatus(requested) ? requested : null;
  const page = pageParam(params.page);
  const [list, pipeline] = await Promise.all([
    listQuotes(ctx, { search, status: status ?? undefined, page, pageSize: parsePageSize(params.size) }),
    quotePipeline(ctx),
  ]);
  const { singular, plural } = ctx.market.documents.quote;
  const strip = quoteStrip(pipeline, ctx.market.documents.quote, { locale: ctx.locale, currency: ctx.currency });
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

      <SummaryStrip label={`${singular} summary`} rows={strip} />

      <ListPending>
        <div className="mt-5 grid gap-3">
          <ListSearch
            action="/quotes"
            label={`Search ${plural.toLowerCase()}`}
            placeholder="Number or customer"
            value={search}
            keep={{ status: status?.toLowerCase(), size: keptSize(list.pageSize) }}
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ListViews
              label={`${plural} by status`}
              views={[
                { href: quotesHref(search, null, list.pageSize), label: "All", current: status === null },
                ...QUOTE_STATUSES.map((s) => ({
                  href: quotesHref(search, s, list.pageSize),
                  label: quoteStatusPresentation[s].label,
                  current: status === s,
                })),
              ]}
            />
          </div>
        </div>

        <ListResults label={`Loading ${plural.toLowerCase()}`} skeleton={<QuoteListSkeleton label={`${singular} list`} />}>
          {list.quotes.length === 0 ? (
            <section aria-label={`${singular} list`} className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No ${plural.toLowerCase()} match “${search}”` : `No ${plural.toLowerCase()} here`}
                description={search ? "Try the number or the customer's name." : "Nothing has this status yet."}
                action={
                  <Link href={quotesHref(null, null, list.pageSize)} className={buttonVariants({ variant: "outline" })}>
                    Show all {plural.toLowerCase()}
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label={`${singular} list`}
              columns={quoteColumns(ctx.locale)}
              rows={list.quotes}
              rowKey={(quote) => quote.id}
              rowHref={(quote) => `/quotes/${quote.id}` as Route}
              phoneSummary={quoteSummary(ctx.locale)}
              controls={2}
              strip
              meta={list}
              noun={{ singular: singular.toLowerCase(), plural: plural.toLowerCase() }}
              hrefFor={pagedHref("/quotes", { q: search, status: status?.toLowerCase() }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
