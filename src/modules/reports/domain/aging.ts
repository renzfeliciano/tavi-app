import { type CalendarDate, daysBetween } from "@/shared/dates/calendar";

// How long unpaid bills have been overdue (2.2, D18), in the buckets
// accountants use. Overdue means past the due date, the dashboard's test
// (§G.2): a bill due today isn't overdue yet.

export const AGING_BUCKETS = [
  { key: "current", maxDaysOverdue: 0 },
  { key: "1-30", maxDaysOverdue: 30 },
  { key: "31-60", maxDaysOverdue: 60 },
  { key: "61-90", maxDaysOverdue: 90 },
  { key: "over-90", maxDaysOverdue: Number.POSITIVE_INFINITY },
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number]["key"];

/** Days past the due date, or 0 while it isn't due yet. */
export function daysOverdue(dueDate: CalendarDate, today: CalendarDate): number {
  return Math.max(0, daysBetween(dueDate, today));
}

export function agingBucket(dueDate: CalendarDate, today: CalendarDate): AgingBucket {
  const days = daysOverdue(dueDate, today);
  for (const bucket of AGING_BUCKETS) if (days <= bucket.maxDaysOverdue) return bucket.key;
  return "over-90";
}
