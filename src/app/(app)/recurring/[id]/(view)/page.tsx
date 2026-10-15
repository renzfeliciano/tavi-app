import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentNumber } from "@/components/document-number";
import { MoneyAmount } from "@/components/money-amount";
import { StatusBadge } from "@/components/status/status-badge";
import { getCustomer } from "@/modules/customers";
import { formatQuantity } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { getSchedule } from "@/modules/invoices";
import { recurrenceLabel } from "@/modules/invoices/client";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { firstDraftText } from "../../_lib/first-draft";
import { endScheduleAction, pauseScheduleAction, resumeScheduleAction } from "../../actions";
import { ScheduleActions } from "../../_components/schedule-actions";
import { ScheduleStatusBadge } from "../../_components/schedule-status";

export const metadata: Metadata = { title: "Recurring statement" };

const SECTION = "min-w-0";
const CARD = "mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs";

export default async function SchedulePage({ params }: PageProps<"/recurring/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const schedule = await getSchedule(ctx, id);
  if (!schedule) notFound();
  const customer = await getCustomer(ctx, schedule.customerId);
  const date = (value: string) => formatCalendarDate(value, ctx.locale);
  const { singular, plural } = ctx.market.documents.invoice;

  const ends =
    schedule.endsOn && schedule.maxDrafts
      ? `${date(schedule.endsOn)}, or after ${schedule.maxDrafts} ${schedule.maxDrafts === 1 ? "statement" : "statements"}`
      : schedule.endsOn
        ? date(schedule.endsOn)
        : schedule.maxDrafts
          ? `After ${schedule.maxDrafts} ${schedule.maxDrafts === 1 ? "statement" : "statements"}`
          : "Never";
  const facts: [string, string][] = [
    ["Repeats", recurrenceLabel(schedule)],
    ["Next statement", schedule.status === "ended" ? "None" : date(schedule.nextRunOn)],
    ["Ends", ends],
    ["Made so far", `${schedule.draftsCreated}${schedule.lastRunOn ? `, the last on ${date(schedule.lastRunOn)}` : ""}`],
    ["Due", `${schedule.termsDays} ${schedule.termsDays === 1 ? "day" : "days"} after it is made`],
  ];

  return (
    <>
      <BackLink href="/recurring">Recurring</BackLink>
      <PageHeader
        title={customer?.displayName ?? "Customer removed"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ScheduleStatusBadge status={schedule.status} />
            <span>{recurrenceLabel(schedule)}</span>
          </span>
        }
        actions={
          <ScheduleActions
            id={schedule.id}
            status={schedule.status}
            pauseReason={schedule.pauseReason}
            pause={pauseScheduleAction.bind(null, schedule.id)}
            resume={resumeScheduleAction.bind(null, schedule.id)}
            end={endScheduleAction.bind(null, schedule.id)}
          />
        }
      />

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <section aria-labelledby="schedule-facts" className={SECTION}>
          <h2 id="schedule-facts" className="text-base font-semibold">
            Schedule
          </h2>
          <dl className={`${CARD} divide-y divide-border`}>
            {facts.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 px-4 py-3 text-sm sm:px-5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="schedule-lines" className={SECTION}>
          <h2 id="schedule-lines" className="text-base font-semibold">
            Each {singular.toLowerCase()}
          </h2>
          <div className={CARD}>
            <ul className="divide-y divide-border">
              {schedule.lines.map((line) => (
                <li key={line.position} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3 text-sm sm:px-5">
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{line.description}</span>
                    <span className="block text-muted-foreground">
                      {formatQuantity(line.quantity, ctx.locale)} {line.unitLabel} ×{" "}
                      <MoneyAmount amountMinor={line.unitPriceMinor} currency={schedule.currency} locale={ctx.locale} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t border-border bg-secondary/40 px-4 py-3 text-sm sm:px-5">
              <span className="text-muted-foreground">Total each time</span>
              <MoneyAmount amountMinor={schedule.totalMinor} currency={schedule.currency} locale={ctx.locale} className="font-semibold" />
            </div>
            {(schedule.notes || schedule.terms) && (
              <div className="grid gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                {schedule.notes && <p className="whitespace-pre-line">{schedule.notes}</p>}
                {schedule.terms && <p className="whitespace-pre-line">{schedule.terms}</p>}
              </div>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="schedule-drafts" className="mt-8">
        <h2 id="schedule-drafts" className="text-base font-semibold">
          {plural} made
        </h2>
        {schedule.drafts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">
            None yet. {schedule.status === "ended" ? "The first draft would have been made on its due date." : firstDraftText(schedule.nextRunOn, todayIn(ctx.timezone), date)}
          </p>
        ) : (
          <ul className={`${CARD} divide-y divide-border`}>
            {schedule.drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/invoices/${draft.id}` as Route}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35 sm:px-5 pointer-coarse:min-h-14"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <DocumentNumber number={draft.number} />
                    <StatusBadge kind="invoice" status={draft.status} />
                  </span>
                  <span className="text-sm text-muted-foreground">For {date(draft.forDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
