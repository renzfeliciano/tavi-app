import { addDays, type CalendarDate, compareDates } from "@/shared/dates/calendar";

// What sending a quote needs (§B.3), and how long its customer link lasts (§I).

/** Links stay open this long after the valid-until date, so a late customer still sees why it expired. */
export const QUOTE_LINK_GRACE_DAYS = 30;

/** The end of the grace period: midnight UTC after the last day. */
export function quoteLinkExpiresAt(validUntil: CalendarDate): Date {
  return new Date(`${addDays(validUntil, QUOTE_LINK_GRACE_DAYS + 1)}T00:00:00.000Z`);
}

/** Problems that stop a draft from being sent, keyed like the editor's fields; empty when ready. */
export function readinessToSend(
  quote: { customerId: string | null; lineCount: number; validUntil: CalendarDate },
  today: CalendarDate,
): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!quote.customerId) problems.customerId = "Choose a customer before sending.";
  if (quote.lineCount === 0) problems.lines = "Add at least one item before sending.";
  if (compareDates(quote.validUntil, today) < 0) {
    problems.validUntil = "This quote's valid-until date has passed. Choose a date from today on.";
  }
  return problems;
}
