import {
  addDays,
  type CalendarDate,
  compareDates,
  isCalendarDate,
} from "@/shared/dates/calendar";

// When a repeating bill comes due (spec 2): weekly, monthly, quarterly or yearly,
// on a day of the month (a day past a short month's end runs on its last day) or a
// weekday. Dates are calendar days in the business's time zone, never instants.

export const RECURRENCE_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/** `anchorDay` is 1–31 (the day of the month), or 1–7 for weekly with Monday = 1. `anchorMonth` is 1–12 for yearly, else null. */
export type Recurrence = {
  frequency: RecurrenceFrequency;
  anchorDay: number;
  anchorMonth: number | null;
};

export const RECURRENCE_LIMITS = { maxDraftsMax: 120 } as const;

/** A schedule that falls this far behind is brought up to date in one step; far beyond any real gap. */
const MAX_STEPS = 20_000;

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parts(date: CalendarDate): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** The date in the given month on `day`, or on the month's last day when it has fewer. Months past 12 roll into the next year. */
function onDay(year: number, month: number, day: number): CalendarDate {
  const zeroBased = month - 1;
  const y = year + Math.floor(zeroBased / 12);
  const m = (((zeroBased % 12) + 12) % 12) + 1;
  return `${pad(y, 4)}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

/** Monday = 1 … Sunday = 7. */
function weekday(date: CalendarDate): number {
  const { year, month, day } = parts(date);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

/** The first due date strictly after `after`. A quarterly schedule keeps the months of the date it is given, so pass one of its due dates. */
export function nextRunOn(rule: Recurrence, after: CalendarDate): CalendarDate {
  const { year, month } = parts(after);
  switch (rule.frequency) {
    case "weekly": {
      const ahead = (rule.anchorDay - weekday(after) + 7) % 7 || 7;
      return addDays(after, ahead);
    }
    case "monthly": {
      const sameMonth = onDay(year, month, rule.anchorDay);
      return compareDates(sameMonth, after) > 0
        ? sameMonth
        : onDay(year, month + 1, rule.anchorDay);
    }
    case "quarterly":
      return onDay(year, month + 3, rule.anchorDay);
    case "yearly": {
      const anchorMonth = rule.anchorMonth ?? 1;
      const thisYear = onDay(year, anchorMonth, rule.anchorDay);
      return compareDates(thisYear, after) > 0
        ? thisYear
        : onDay(year + 1, anchorMonth, rule.anchorDay);
    }
  }
}

/** The first due date on or after `startOn`. A quarterly schedule's months start from the month of this date. */
export function firstRunOn(
  rule: Recurrence,
  startOn: CalendarDate,
): CalendarDate {
  if (rule.frequency === "quarterly")
    return firstRunOn({ ...rule, frequency: "monthly" }, startOn);
  return nextRunOn(rule, addDays(startOn, -1));
}

/**
 * Brings a schedule up to date: from its due date `due`, the latest due date that is on or before `today`
 * (the one a draft is made for) and the first one after it. A long gap makes one draft, not one per missed period.
 */
export function advancePast(
  rule: Recurrence,
  due: CalendarDate,
  today: CalendarDate,
): { latest: CalendarDate; next: CalendarDate } {
  let latest = due;
  let next = nextRunOn(rule, latest);
  for (
    let steps = 0;
    compareDates(next, today) <= 0 && steps < MAX_STEPS;
    steps++
  ) {
    latest = next;
    next = nextRunOn(rule, latest);
  }
  return { latest, next };
}

/** Whether a schedule has made its last statement: its count is used up, or the next due date is past its end date. */
export function isFinished(
  schedule: {
    endsOn: CalendarDate | null;
    maxDrafts: number | null;
    draftsCreated: number;
  },
  nextRun: CalendarDate,
): boolean {
  if (
    schedule.maxDrafts !== null &&
    schedule.draftsCreated >= schedule.maxDrafts
  )
    return true;
  return schedule.endsOn !== null && compareDates(nextRun, schedule.endsOn) > 0;
}

type RecurrenceInput = {
  rule: Recurrence;
  startOn: CalendarDate;
  endsOn: CalendarDate | null;
  maxDrafts: number | null;
};

export type RecurrenceResult =
  | ({ ok: true } & RecurrenceInput)
  | { ok: false; errors: Record<string, string> };

const asText = (value: unknown) =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : "";
const WHOLE_NUMBER = /^\d{1,9}$/;

/** What the Repeat form sends (numbers may arrive as text), checked against today in the business's time zone. */
export function parseRecurrence(
  input: unknown,
  { today }: { today: CalendarDate },
): RecurrenceResult {
  const source =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};

  const frequency = asText(source.frequency);
  const known = (RECURRENCE_FREQUENCIES as readonly string[]).includes(
    frequency,
  );
  if (!known) errors.frequency = "Choose how often it repeats.";

  const dayText = asText(source.anchorDay);
  const anchorDay = WHOLE_NUMBER.test(dayText) ? Number(dayText) : Number.NaN;
  const maxDay = frequency === "weekly" ? 7 : 31;
  if (!(anchorDay >= 1 && anchorDay <= maxDay)) {
    errors.anchorDay =
      frequency === "weekly"
        ? "Choose a day of the week."
        : "Choose a day of the month, 1 to 31.";
  }

  let anchorMonth: number | null = null;
  if (frequency === "yearly") {
    const monthText = asText(source.anchorMonth);
    const month = WHOLE_NUMBER.test(monthText) ? Number(monthText) : Number.NaN;
    if (month >= 1 && month <= 12) anchorMonth = month;
    else errors.anchorMonth = "Choose the month it repeats in.";
  }

  const startText = asText(source.startOn);
  if (!isCalendarDate(startText)) errors.startOn = "Choose a start date.";
  else if (compareDates(startText, today) < 0)
    errors.startOn = "Choose a start date from today on.";

  const endText = asText(source.endsOn);
  let endsOn: CalendarDate | null = null;
  if (endText !== "") {
    if (!isCalendarDate(endText))
      errors.endsOn = "Choose a real end date, or leave it empty.";
    else if (isCalendarDate(startText) && compareDates(endText, startText) < 0)
      errors.endsOn = "Choose an end date on or after the start date.";
    else endsOn = endText;
  }

  const countText = asText(source.maxDrafts);
  let maxDrafts: number | null = null;
  if (countText !== "") {
    const count = WHOLE_NUMBER.test(countText) ? Number(countText) : Number.NaN;
    if (count >= 1 && count <= RECURRENCE_LIMITS.maxDraftsMax)
      maxDrafts = count;
    else
      errors.maxDrafts = `Enter a number from 1 to ${RECURRENCE_LIMITS.maxDraftsMax}, or leave it empty.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    rule: {
      frequency: frequency as RecurrenceFrequency,
      anchorDay,
      anchorMonth,
    },
    startOn: startText,
    endsOn,
    maxDrafts,
  };
}

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Every month on the 15th": the schedule in words, for lists and toasts. */
export function recurrenceLabel(rule: Recurrence): string {
  const shortMonths =
    rule.anchorDay > 28 ? " (the last day in shorter months)" : "";
  switch (rule.frequency) {
    case "weekly":
      return `Every week on ${WEEKDAYS[rule.anchorDay - 1] ?? "the chosen day"}`;
    case "monthly":
      return `Every month on the ${ordinal(rule.anchorDay)}${shortMonths}`;
    case "quarterly":
      return `Every 3 months on the ${ordinal(rule.anchorDay)}${shortMonths}`;
    case "yearly":
      return `Every year on ${rule.anchorDay} ${MONTH_NAMES[(rule.anchorMonth ?? 1) - 1] ?? ""}`.trim();
  }
}
