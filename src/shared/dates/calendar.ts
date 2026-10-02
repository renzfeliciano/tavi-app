// Calendar dates ("2026-10-01"): a document's issue, valid-until and due
// dates are days in the business's own time zone, not instants. They're kept
// as ISO strings (Postgres `date`) and only become Date objects at UTC
// midnight for arithmetic and display, so the day never shifts.

export type CalendarDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date where the business is (its IANA time zone). */
export function todayIn(timezone: string, now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUtc(date: CalendarDate): Date {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Not a calendar date: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

const fromUtc = (date: Date): CalendarDate => date.toISOString().slice(0, 10);

/** A real date in YYYY-MM-DD form (no 30 February). */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Whole days from `from` to `to`: negative when `to` comes first. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Negative if `a` is before `b`, zero if the same day. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "Oct 1, 2026" (en-PH), "01.10.2026" (de-DE). */
export function formatCalendarDate(date: CalendarDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(toUtc(date));
}
