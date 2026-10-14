import { type CalendarDate, daysBetween, formatCalendarDate } from "./calendar";

/**
 * When something last happened, for a list: "Today", "Yesterday", "3 days ago", then the date itself from a week
 * back. Words only for the days a person still counts in; a date doesn't go stale on a page left open. A day that
 * is still ahead (a document dated for next week) hasn't happened yet, so it is the date itself, never "Today".
 */
export function recentDay(on: CalendarDate, today: CalendarDate, locale: string): string {
  const days = daysBetween(on, today);
  if (days < 0) return formatCalendarDate(on, locale);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatCalendarDate(on, locale);
}
