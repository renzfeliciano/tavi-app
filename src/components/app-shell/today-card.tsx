"use client";

import Link from "next/link";
import { Suspense, use, useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/shared/money/format";
import type { ShellAccount } from "./account";
import { noteFor, type ShellFacts } from "./facts";

/** What the card would say for this business, from real figures only. Empty when there is nothing to report. */
export function todayLines(facts: ShellFacts, documents: ShellAccount["documents"]) {
  const statements = documents.invoice.plural.toLowerCase();
  const lines: { key: string; label: string; value: string; tone: "alert" | "plain" }[] = [];
  if (facts.overdueCount) lines.push({ key: "overdue", label: `Overdue ${statements}`, value: String(facts.overdueCount), tone: "alert" });
  if (facts.draftCount) lines.push({ key: "drafts", label: `Draft ${documents.quote.plural.toLowerCase()}`, value: String(facts.draftCount), tone: "plain" });
  for (const money of facts.unpaid?.slice(0, 2) ?? []) {
    lines.push({ key: `unpaid-${money.currency}`, label: "Still unpaid", value: formatMoney(money.outstandingMinor, money.currency), tone: "plain" });
  }
  return lines;
}

function TodayBody({ facts, documents, showNote }: { facts: Promise<ShellFacts>; documents: ShellAccount["documents"]; showNote: boolean }) {
  const resolved = use(facts);
  const note = noteFor(resolved);
  const lines = todayLines(resolved, documents);
  const deadline = resolved.deadline;
  return (
    <>
      {showNote && <p className="text-sm leading-snug text-foreground">{note.message}</p>}
      {showNote && note.action && (
        <Link
          href={note.action.href as never}
          className="w-fit rounded-sm text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          {note.action.label}
        </Link>
      )}
      {lines.length > 0 && (
        <dl className="grid gap-1 border-t border-border pt-2 text-sm short:hidden">
          {lines.map((line) => (
            <div key={line.key} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className={line.tone === "alert" ? "font-semibold text-danger-strong tabular-nums" : "font-medium tabular-nums"}>
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {deadline && (
        <Link
          href={deadline.href as never}
          className="w-fit rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          {deadline.title} {deadline.daysLeft < 0 ? "(past due)" : deadline.daysLeft === 0 ? "today" : `in ${deadline.daysLeft} ${deadline.daysLeft === 1 ? "day" : "days"}`}
        </Link>
      )}
    </>
  );
}

/** The same card, still empty: the shape the real one fills, so nothing jumps. */
export function TodayCardSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-2">
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** "Today": what the business needs right now, in a few real figures, with the Stamp's one suggestion. Hidden when collapsed. */
export function TodayCard({
  facts,
  documents,
  showNote,
}: {
  facts: Promise<ShellFacts>;
  documents: ShellAccount["documents"];
  showNote: boolean;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mx-3 mt-4 mb-3 short:mt-3 short:mb-2 grid gap-2 rounded-lg border border-border bg-card p-3 shadow-xs group-data-[sidebar=collapsed]/shell:hidden"
    >
      <h2 id={headingId} className="text-eyebrow font-semibold tracking-wider text-muted-foreground uppercase">
        Today
      </h2>
      <Suspense fallback={<TodayCardSkeleton />}>
        <TodayBody facts={facts} documents={documents} showNote={showNote} />
      </Suspense>
    </section>
  );
}
