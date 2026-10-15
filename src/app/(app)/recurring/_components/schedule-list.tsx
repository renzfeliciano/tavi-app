import { type DataColumn, DataTableSkeleton } from "@/components/data-table";
import { CellSub, CellTitle } from "@/components/list-cells";
import { MoneyAmount } from "@/components/money-amount";
import { Monogram } from "@/components/monogram";
import type { ScheduleSummary } from "@/modules/invoices";
import { recurrenceLabel } from "@/modules/invoices/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { ScheduleStatusBadge } from "./schedule-status";

const labelOf = (schedule: ScheduleSummary) =>
  recurrenceLabel({ frequency: schedule.frequency, anchorDay: schedule.anchorDay, anchorMonth: schedule.anchorMonth });

/** Shown where a schedule has no next date: a paused one keeps its date, an ended one has none. */
const nextOf = (schedule: ScheduleSummary, locale: string) =>
  schedule.status === "ended" ? null : formatCalendarDate(schedule.nextRunOn, locale);

/**
 * The recurring list's columns: one definition for the table and for its skeleton, so the two never drift.
 * The customer leads with how often it repeats; what each statement comes to is the figure kept on a phone.
 */
export const scheduleColumns = (locale: string): DataColumn<ScheduleSummary>[] => [
  {
    id: "customer",
    header: "Customer",
    width: "minmax(0,2.2fr)",
    phone: "title",
    lead: "disc",
    skeleton: ["lg", "md"],
    cell: (schedule) => (
      <span className="flex items-center gap-3">
        <Monogram name={schedule.customerName ?? "?"} />
        <span className="min-w-0 flex-1">
          <CellTitle>{schedule.customerName ?? "Customer removed"}</CellTitle>
          <CellSub>{labelOf(schedule)}</CellSub>
        </span>
      </span>
    ),
  },
  {
    id: "next",
    header: "Next statement",
    width: "minmax(0,1.3fr)",
    hideBelow: "md",
    skeleton: ["sm", "md"],
    cell: (schedule) => {
      const next = nextOf(schedule, locale);
      return next ? (
        <>
          <span className="block truncate text-sm">{next}</span>
          {schedule.status === "paused" && <CellSub>On hold</CellSub>}
        </>
      ) : (
        <CellSub>No more due</CellSub>
      );
    },
  },
  {
    id: "made",
    header: "Made so far",
    width: "7rem",
    align: "end",
    hideBelow: "lg",
    skeleton: "xs",
    cell: (schedule) => <span className="block text-sm tabular-nums">{schedule.draftsCreated}</span>,
  },
  {
    id: "amount",
    header: "Each statement",
    width: "9.5rem",
    align: "end",
    phone: "end",
    skeleton: "sm",
    cell: (schedule) => (
      <MoneyAmount amountMinor={schedule.totalMinor} currency={schedule.currency} locale={locale} className="block font-medium" />
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "8rem",
    hideBelow: "md",
    skeleton: "sm",
    cell: (schedule) => <ScheduleStatusBadge status={schedule.status} />,
  },
];

/** What a phone shows under the customer's name, in place of the columns it leaves out. */
export const scheduleSummary = (locale: string) => (schedule: ScheduleSummary) => {
  const next = nextOf(schedule, locale);
  const state = schedule.status === "active" ? (next ? `Next ${next}` : "") : schedule.status === "paused" ? "Paused" : "Ended";
  return [labelOf(schedule), state].filter(Boolean).join(" · ");
};

/** The list's panel while its rows load: the loading screen's, and what stands in for the rows while a tab, page or search loads. */
export function ScheduleListSkeleton() {
  return <DataTableSkeleton label="Recurring list" columns={scheduleColumns("en-PH")} summary />;
}
