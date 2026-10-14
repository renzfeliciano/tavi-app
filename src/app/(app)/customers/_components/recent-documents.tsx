import type { Route } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { DocumentNumber } from "@/components/document-number";
import { MoneyAmount } from "@/components/money-amount";
import { StatusBadgeSkeleton, TextSkeleton, vary } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status/status-badge";
import { buttonVariants } from "@/components/ui/button";
import type { MarketProfile } from "@/config/markets";
import type { InvoiceList } from "@/modules/invoices";
import type { QuoteList } from "@/modules/quotes";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";

type QuoteRow = QuoteList["quotes"][number];
type InvoiceRow = InvoiceList["invoices"][number];

type Props = {
  customerId: string;
  locale: string;
  market: Pick<MarketProfile, "documents">;
  /** Whether to offer starting a new one for this customer (not for an archived customer). */
  canCreate: boolean;
} & (
  | { kind: "quote"; rows: readonly QuoteRow[]; total: number }
  | { kind: "invoice"; rows: readonly InvoiceRow[]; total: number }
);

// Shared with the skeleton, so the two never drift apart.
const LIST = "mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs";
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35 sm:px-5 pointer-coarse:min-h-14";

/**
 * A customer's latest quotations or billing statements, most recently changed first: what the record
 * page shows of the full lists. Each row opens the document.
 */
export function RecentDocuments(props: Props) {
  const { kind, customerId, locale, market, canCreate, total } = props;
  const noun = market.documents[kind];
  const base = kind === "quote" ? "/quotes" : "/invoices";
  const headingId = `recent-${kind}-heading`;
  const shown = props.rows.length;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={headingId} className="text-base font-semibold">
            {noun.plural}
          </h2>
          {total > shown && <span className="text-sm text-muted-foreground">Latest {shown} of {total}</span>}
        </div>
        {canCreate && (
          <Link href={`${base}/new?customer=${customerId}` as Route} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PlusIcon aria-hidden="true" />
            New {noun.singular.toLowerCase()}
          </Link>
        )}
      </div>
      {shown === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">
          No {noun.plural.toLowerCase()} yet.
        </p>
      ) : (
        <ul className={LIST}>
          {props.kind === "quote"
            ? props.rows.map((quote) => (
                <li key={quote.id}>
                  <Link href={`/quotes/${quote.id}` as Route} className={ROW}>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <DocumentNumber number={quote.number} />
                        <StatusBadge kind="quote" status={quote.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {formatCalendarDate(quote.issueDate, locale)}
                      </span>
                    </span>
                    <MoneyAmount amountMinor={quote.totalMinor} currency={quote.currency} locale={locale} className="text-sm font-medium" />
                  </Link>
                </li>
              ))
            : props.rows.map((invoice) => {
                const partPaid = invoice.amountPaidMinor > 0 && invoice.status !== "PAID";
                return (
                  <li key={invoice.id}>
                    <Link href={`/invoices/${invoice.id}` as Route} className={ROW}>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <DocumentNumber number={invoice.number} />
                          <StatusBadge kind="invoice" status={invoice.status} />
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                          Due {formatCalendarDate(invoice.dueDate, locale)}
                        </span>
                      </span>
                      <span className="grid justify-items-end text-right">
                        <MoneyAmount amountMinor={invoice.totalMinor} currency={invoice.currency} locale={locale} className="text-sm font-medium" />
                        {partPaid && (
                          <span className="text-xs text-muted-foreground">
                            {formatMoney(invoice.amountPaidMinor, invoice.currency, { locale })} paid
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
        </ul>
      )}
    </section>
  );
}

/** The list's shape while the customer's page loads: heading and action, then rows of number, status, date and amount. */
export function RecentDocumentsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <TextSkeleton size="base" width="w-28" />
        <Skeleton className="h-7 w-36 pointer-coarse:h-11" />
      </div>
      <ul className={LIST}>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i}>
            <div className={ROW}>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <TextSkeleton width={vary(["w-24", "w-28", "w-20"], i)} />
                  <StatusBadgeSkeleton />
                </span>
                <TextSkeleton width={vary(["w-28", "w-24", "w-32"], i)} className="mt-0.5" />
              </span>
              <TextSkeleton width="w-16" className="justify-end" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
