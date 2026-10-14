import Link from "next/link";
import { AlertTriangleIcon, CalendarClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { relativeDays } from "@/shared/dates/relative-days";
import type { Deadline } from "@/modules/organizations";

export const whenLabel = relativeDays;

/** Within two weeks, or already past. */
const isSoon = (d: Deadline) => d.daysLeft <= 14;

export function DeadlinesCard({
  deadlines,
  locale,
  note,
  /** Why there is nothing to list, when that's because something isn't set yet. */
  missing,
}: {
  deadlines: Deadline[];
  locale: string;
  note: string;
  missing: { text: string; href: "/settings/business" | null } | null;
}) {
  return (
    <section id="deadlines" aria-labelledby="deadlines-heading" className="scroll-mt-20 rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id="deadlines-heading" className="font-semibold">
          Coming up
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">Returns to file and renewals, from your registration below.</p>
      </header>
      {deadlines.length > 0 ? (
        <ul className="divide-y divide-border">
          {deadlines.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md border",
                  isSoon(d) ? "border-warning/40 bg-warning-subtle text-warning-strong" : "border-border bg-surface-sunken text-ink-subtle",
                )}
              >
                {isSoon(d) ? <AlertTriangleIcon className="size-4" /> : <CalendarClockIcon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {d.form && <span className="mr-2 font-mono text-ink-subtle">{d.form}</span>}
                  {d.name}
                </p>
                {d.periodEnd && (
                  <p className="text-sm text-muted-foreground">For the period ending {formatCalendarDate(d.periodEnd, locale)}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">{formatCalendarDate(d.dueOn, locale)}</p>
                <p className={cn("text-sm", isSoon(d) ? "font-medium text-warning-strong" : "text-muted-foreground")}>
                  {d.kind === "renewal" && d.daysLeft < 0 ? "Lapsed " : ""}
                  {whenLabel(d.daysLeft)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-5 text-sm text-pretty text-muted-foreground sm:px-6">
          {missing ? (
            <>
              {missing.text}{" "}
              {missing.href && (
                <Link href={missing.href} className="font-medium text-foreground underline underline-offset-4">
                  Open business profile
                </Link>
              )}
            </>
          ) : (
            "Nothing due in the next year."
          )}
        </p>
      )}
      <p className="border-t border-border px-5 py-3 text-sm text-pretty text-muted-foreground sm:px-6">{note}</p>
    </section>
  );
}
