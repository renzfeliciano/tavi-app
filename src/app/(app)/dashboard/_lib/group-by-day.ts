import { addDays, type CalendarDate, formatCalendarDate, todayIn } from "@/shared/dates/calendar";

export type DayGroup<T> = {
  day: CalendarDate;
  /** "Today", "Yesterday" (in the business's language), else the date. */
  label: string;
  items: T[];
};

/**
 * Events under the day they happened, where the business is (its time zone, not UTC). Groups come in the order
 * their first event does, so newest-first in gives newest day first out.
 */
export function groupByDay<T extends { createdAt: Date }>(
  items: readonly T[],
  { today, timezone, locale }: { today: CalendarDate; timezone: string; locale: string },
): DayGroup<T>[] {
  const words = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const capitalised = (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  const yesterday = addDays(today, -1);
  const label = (day: CalendarDate) =>
    day === today
      ? capitalised(words.format(0, "day"))
      : day === yesterday
        ? capitalised(words.format(-1, "day"))
        : formatCalendarDate(day, locale);

  const groups = new Map<CalendarDate, DayGroup<T>>();
  for (const item of items) {
    const day = todayIn(timezone, item.createdAt);
    const group = groups.get(day) ?? { day, label: label(day), items: [] };
    group.items.push(item);
    groups.set(day, group);
  }
  return [...groups.values()];
}
