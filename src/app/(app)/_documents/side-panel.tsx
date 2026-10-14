import type { Route } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Monogram } from "@/components/monogram";
import { TextSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DocumentPanelData } from "./panel-data";

// Shared with the skeleton and with the pages' loading screens, so a page and what stands in for it while it
// loads never drift apart.

/**
 * The page under an issued document's header: the paper (and any payments) in one column, the panel beside it
 * from desktop width up, and everything in one stack below that.
 */
export const DOCUMENT_BODY = "mt-6 grid max-w-3xl gap-6 xl:mt-8 xl:max-w-none xl:grid-cols-[minmax(0,48rem)_18rem] xl:gap-x-8";

/** Where the panel goes in that grid: the right column, level with the first row, or with the first two when payments sit over the paper. */
export const panelPlace = (rows: 1 | 2) => (rows === 2 ? "xl:col-start-2 xl:row-start-1 xl:row-span-2" : "xl:col-start-2 xl:row-start-1");

const CARD = "divide-y divide-border rounded-xl border border-border bg-card shadow-xs xl:sticky xl:top-6 xl:self-start";
const SECTION = "grid gap-3 p-5";
const HEADING = "text-sm font-semibold";

export function DocumentSidePanel({ label, data, className }: { label: string; data: DocumentPanelData; className?: string }) {
  const { customer, facts, events, related } = data;
  return (
    <aside aria-label={label} className={cn(CARD, className)}>
      {customer && (
        <section aria-labelledby="panel-customer" className={SECTION}>
          <h2 id="panel-customer" className={HEADING}>
            Customer
          </h2>
          <div className="flex items-start gap-3">
            <Monogram name={customer.name} />
            <div className="min-w-0 text-sm">
              {customer.href ? (
                <Link href={customer.href as Route} className="font-medium break-words underline-offset-4 hover:underline">
                  {customer.name}
                </Link>
              ) : (
                <p className="font-medium break-words">{customer.name}</p>
              )}
              {customer.company && <p className="break-words text-muted-foreground">{customer.company}</p>}
              {customer.email && <p className="break-all text-muted-foreground">{customer.email}</p>}
              {customer.phone && <p className="break-words text-muted-foreground">{customer.phone}</p>}
            </div>
          </div>
        </section>
      )}
      <section aria-labelledby="panel-dates" className={SECTION}>
        <h2 id="panel-dates" className={HEADING}>
          Dates
        </h2>
        <dl className="grid gap-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.key} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="text-right font-medium">
                {fact.value}
                {fact.note && (
                  <span className={cn("block text-xs font-normal", fact.danger ? "text-danger-strong" : "text-muted-foreground")}>{fact.note}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {events.length > 0 && (
        <section aria-labelledby="panel-activity" className={SECTION}>
          <h2 id="panel-activity" className={HEADING}>
            Activity
          </h2>
          <ol className="grid gap-3 text-sm">
            {events.map((event) => (
              <li key={event.key}>
                <p className="font-medium break-words">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.on}</p>
                {event.detail && <p className="mt-1 break-words text-pretty">{event.detail}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {related.length > 0 && (
        <section aria-labelledby="panel-related" className={SECTION}>
          <h2 id="panel-related" className={HEADING}>
            Related
          </h2>
          <ul className="grid gap-2 text-sm">
            {related.map((link) => (
              <li key={link.key}>
                <Link href={link.href as Route} className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline">
                  {link.label}
                  <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

/** The panel's shape while the page loads: the customer, the dates, and a short activity list. */
export function DocumentSidePanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, className)}>
      <div className={SECTION}>
        <TextSkeleton size="sm" width="w-20" />
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <TextSkeleton width="w-36" />
            <TextSkeleton width="w-40" />
          </div>
        </div>
      </div>
      <div className={SECTION}>
        <TextSkeleton size="sm" width="w-14" />
        <div className="grid gap-2">
          <TextSkeleton width="w-full" />
          <TextSkeleton width="w-full" />
        </div>
      </div>
      <div className={SECTION}>
        <TextSkeleton size="sm" width="w-16" />
        <div className="grid gap-3">
          <TextSkeleton width="w-28" />
          <TextSkeleton width="w-32" />
        </div>
      </div>
    </div>
  );
}
