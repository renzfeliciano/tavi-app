import { compareDates } from "@/shared/dates/calendar";

/**
 * When the first draft will appear. The daily job runs just after midnight, so a schedule whose first due date
 * is today (or already past) gets its draft in the next run, not later today.
 */
export function firstDraftText(nextRunOn: string, today: string, formatDate: (date: string) => string): string {
  return compareDates(nextRunOn, today) > 0
    ? `The first draft is made on ${formatDate(nextRunOn)}.`
    : "The first draft is made in the next daily run, shortly after midnight.";
}
