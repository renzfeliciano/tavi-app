import type { Route } from "next";
import type { OverdueInvoice } from "@/modules/invoices";
import type { AttentionQuote, QuotesAttention } from "@/modules/quotes";
import { type CalendarDate, formatCalendarDate } from "@/shared/dates/calendar";
import { daysLate, lateLabel } from "@/shared/dates/lateness";
import { timeAgo } from "./time-ago";

export type AttentionKind = "overdue" | "approved" | "waiting" | "draft";

export type AttentionItem = {
  key: string;
  kind: AttentionKind;
  href: Route;
  /** The issued serial; null for a draft, which has none yet. */
  number: string | null;
  /** Names an unfinished draft by its customer; every other row is known by its serial. */
  title?: string;
  detail: string;
  /** How late, for money past its due date. */
  late?: string;
  amount?: { minor: number; currency: string };
};

export type AttentionInput = {
  overdue: readonly OverdueInvoice[];
  quotes: QuotesAttention;
  today: CalendarDate;
  now: Date;
  locale: string;
  /** The market's word for one quotation ("Quotation"). */
  quoteName: string;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Most urgent first: money already late, then money ready to bill, then nudges. */
export function attentionItems({ overdue, quotes, today, now, locale, quoteName }: AttentionInput): AttentionItem[] {
  const since = (verb: string, date: Date | null) => (date ? `${verb} ${timeAgo(date, now, locale)}` : null);
  const quoteRow = (kind: AttentionKind, q: AttentionQuote, phrase: string | null): AttentionItem => ({
    key: `${kind}-${q.id}`,
    kind,
    href: `/quotes/${q.id}` as Route,
    number: q.number,
    detail: join(q.customerName, phrase),
    amount: { minor: q.totalMinor, currency: q.currency },
  });

  return [
    ...overdue.map(
      (i): AttentionItem => ({
        key: `overdue-${i.id}`,
        kind: "overdue",
        href: `/invoices/${i.id}` as Route,
        number: i.number,
        detail: join(i.customerName, `due ${formatCalendarDate(i.dueDate, locale)}`),
        late: lateLabel(daysLate(i.dueDate, today)),
        amount: { minor: i.balanceMinor, currency: i.currency },
      }),
    ),
    ...quotes.approvedNotInvoiced.map((q) => quoteRow("approved", q, since("approved", q.since))),
    ...quotes.awaitingReply.map((q) => quoteRow("waiting", q, since("sent", q.since))),
    ...quotes.staleDrafts.map(
      (q): AttentionItem => ({
        key: `draft-${q.id}`,
        kind: "draft",
        href: `/quotes/${q.id}` as Route,
        number: null,
        title: q.customerName ?? `Draft ${quoteName.toLowerCase()}`,
        detail: since("last edited", q.since) ?? "",
      }),
    ),
  ];
}
