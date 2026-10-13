import { type CalendarDate, daysBetween } from "@/shared/dates/calendar";

/** Whole days past the due date; zero on the day and before it. */
export function daysLate(due: CalendarDate, today: CalendarDate): number {
  return Math.max(0, daysBetween(due, today));
}

/** "1 day late", "11 days late". */
export function lateLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"} late`;
}
