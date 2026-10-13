import type { Route } from "next";
import Link from "next/link";
import { BanIcon, BanknoteIcon, EyeIcon, type LucideIcon, PencilLineIcon, SendIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import type { ActivityKind } from "../_lib/activity";
import type { DayGroup } from "../_lib/group-by-day";
import { MARK, type Tone } from "./tone";

export type FeedEntry = {
  id: string;
  text: string;
  href: Route | null;
  kind: ActivityKind;
  createdAt: Date;
};

const KINDS: Record<ActivityKind, { icon: LucideIcon; tone: Tone }> = {
  sent: { icon: SendIcon, tone: "info" },
  viewed: { icon: EyeIcon, tone: "info" },
  approved: { icon: ThumbsUpIcon, tone: "success" },
  declined: { icon: ThumbsDownIcon, tone: "danger" },
  edited: { icon: PencilLineIcon, tone: "muted" },
  paid: { icon: BanknoteIcon, tone: "success" },
  closed: { icon: BanIcon, tone: "muted" },
};

/**
 * What happened lately, a day at a time, with the time of day where the business is. The sentence says what
 * happened; the mark beside it only helps the eye find the kind of event, so it is hidden from screen readers.
 */
export function ActivityFeed({ groups, locale, timeZone }: { groups: readonly DayGroup<FeedEntry>[]; locale: string; timeZone: string }) {
  const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone });
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-base font-semibold">
        Recent activity
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-pretty text-muted-foreground">Nothing yet. Sent documents, approvals and payments show up here.</p>
      ) : (
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {groups.map((group) => (
            <div key={group.day} className="pb-1.5">
              <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground sm:px-5">{group.label}</h3>
              <ul>
                {group.items.map((entry) => {
                  const { icon: Icon, tone } = KINDS[entry.kind];
                  return (
                    <li key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 text-sm sm:px-5">
                      <span
                        data-slot="activity-mark"
                        data-kind={entry.kind}
                        aria-hidden="true"
                        className={`grid size-7 place-items-center rounded-full ${MARK[tone]}`}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="min-w-0 text-pretty underline-offset-4 [overflow-wrap:anywhere] hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                        >
                          {entry.text}
                        </Link>
                      ) : (
                        <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{entry.text}</span>
                      )}
                      <time dateTime={entry.createdAt.toISOString()} className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {clock.format(entry.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
