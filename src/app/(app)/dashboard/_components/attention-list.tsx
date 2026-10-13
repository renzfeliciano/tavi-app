import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, type LucideIcon, PencilLineIcon, ThumbsUpIcon } from "lucide-react";
import { DocumentNumber } from "@/components/document-number";
import { MoneyAmount } from "@/components/money-amount";
import type { AttentionItem, AttentionKind } from "../_lib/attention-items";
import { MARK, type Tone } from "./tone";

const KINDS: Record<AttentionKind, { label: string; icon: LucideIcon; tone: Tone }> = {
  overdue: { label: "Overdue", icon: CircleAlertIcon, tone: "danger" },
  approved: { label: "Approved, ready to bill", icon: ThumbsUpIcon, tone: "success" },
  waiting: { label: "No answer yet", icon: ClockIcon, tone: "info" },
  draft: { label: "Unfinished draft", icon: PencilLineIcon, tone: "muted" },
};

/** What needs doing now, most urgent first. Each row says what kind of thing it is in words as well as by its mark. */
export function AttentionList({ items, locale }: { items: readonly AttentionItem[]; locale: string }) {
  return (
    <section aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="text-base font-semibold">
        Needs your attention
      </h2>
      {items.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">
          <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success-strong" />
          <p>You&apos;re all caught up.</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {items.map((item) => {
            const { label, icon: Icon, tone } = KINDS[item.kind];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35 sm:gap-x-4 sm:px-5 pointer-coarse:min-h-14"
                >
                  <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full ${MARK[tone]}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-muted-foreground">{label}</span>
                    <span className="mt-0.5 block text-sm text-pretty [overflow-wrap:anywhere]">
                      {item.title ? <span className="font-medium">{item.title}</span> : <DocumentNumber number={item.number} className="font-medium" />}
                      {item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}
                    </span>
                  </span>
                  {(item.amount || item.late) && (
                    <span className="grid justify-items-end text-right">
                      {item.amount && (
                        <MoneyAmount amountMinor={item.amount.minor} currency={item.amount.currency} locale={locale} className="text-sm font-medium" />
                      )}
                      {item.late && <span className="text-xs font-medium text-danger-strong">{item.late}</span>}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
