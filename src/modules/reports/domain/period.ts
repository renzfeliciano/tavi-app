import { addDays, type CalendarDate, daysBetween, isCalendarDate } from "@/shared/dates/calendar";

// Report periods (2.2, D18): calendar months, quarters and years around
// today in the business's own time zone (the caller passes that day), or any
// range of days up to REPORT_LIMITS.maxDays. Bills and payments carry
// calendar dates, so a bill issued on 31 March is in Q1 wherever the server
// runs.

export const REPORT_PERIODS = [
  "this-month",
  "last-month",
  "this-quarter",
  "last-quarter",
  "this-year",
  "last-year",
] as const;
export type ReportPeriodPreset = (typeof REPORT_PERIODS)[number];

export const REPORT_LIMITS = {
  /** The longest custom period, in days counting both ends: a leap year. */
  maxDays: 366,
} as const;

export type ReportPeriod = { preset: ReportPeriodPreset | null; from: CalendarDate; to: CalendarDate };

/** `count` whole months from the start of `month` (1–12, or beyond either end of the year). */
function months(year: number, month: number, count: number): { from: CalendarDate; to: CalendarDate } {
  const day = (date: number) => new Date(date).toISOString().slice(0, 10);
  // Day 0 of a month is the last day of the one before it.
  return { from: day(Date.UTC(year, month - 1, 1)), to: day(Date.UTC(year, month - 1 + count, 0)) };
}

export function presetPeriod(preset: ReportPeriodPreset, today: CalendarDate): ReportPeriod {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarterStart = month - ((month - 1) % 3);
  const spans: Record<ReportPeriodPreset, () => { from: CalendarDate; to: CalendarDate }> = {
    "this-month": () => months(year, month, 1),
    "last-month": () => months(year, month - 1, 1),
    "this-quarter": () => months(year, quarterStart, 3),
    "last-quarter": () => months(year, quarterStart - 3, 3),
    "this-year": () => months(year, 1, 12),
    "last-year": () => months(year - 1, 1, 12),
  };
  return { preset, ...spans[preset]() };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
const isPreset = (value: string | undefined): value is ReportPeriodPreset =>
  (REPORT_PERIODS as readonly (string | undefined)[]).includes(value);

/**
 * The period a report asks for, from `?period=` or `?from=&to=`. Dates it
 * can't use fall back to this month, with the reason to show.
 */
export function parseReportPeriod(
  params: Record<string, string | string[] | undefined>,
  today: CalendarDate,
): { period: ReportPeriod; error: string | null } {
  const fallback = presetPeriod("this-month", today);
  const from = first(params.from);
  const to = first(params.to);
  if (from === undefined && to === undefined) {
    const preset = first(params.period);
    return { period: isPreset(preset) ? presetPeriod(preset, today) : fallback, error: null };
  }
  const refuse = (error: string) => ({ period: fallback, error });
  if (from === undefined || to === undefined) return refuse("Choose both a start and an end date.");
  if (!isCalendarDate(from) || !isCalendarDate(to)) return refuse("Choose real dates for the period.");
  if (to < from) return refuse("Choose an end date on or after the start date.");
  if (daysBetween(from, to) + 1 > REPORT_LIMITS.maxDays) {
    return refuse(`Choose a period of ${REPORT_LIMITS.maxDays} days or less.`);
  }
  const preset = REPORT_PERIODS.find((p) => {
    const span = presetPeriod(p, today);
    return span.from === from && span.to === to;
  });
  return { period: { preset: preset ?? null, from, to }, error: null };
}

/**
 * The period just before this one, for "compared with last month". Whole
 * calendar months (a month, a quarter, a year) step back by that many months,
 * so March compares with February, not with the last 31 days. Any other range
 * compares with the same number of days directly before it.
 */
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  const fromYear = Number(period.from.slice(0, 4));
  const fromMonth = Number(period.from.slice(5, 7));
  const toYear = Number(period.to.slice(0, 4));
  const toMonth = Number(period.to.slice(5, 7));
  const count = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  const wholeMonths = period.from.slice(8) === "01" && period.to === months(toYear, toMonth, 1).to;
  if (wholeMonths) return { preset: null, ...months(fromYear, fromMonth - count, count) };
  const length = daysBetween(period.from, period.to) + 1;
  return { preset: null, from: addDays(period.from, -length), to: addDays(period.from, -1) };
}
