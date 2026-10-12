/** "today", "tomorrow", "in 13 days", "yesterday", "5 days ago". */
export function relativeDays(daysLeft: number): string {
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  if (daysLeft === -1) return "yesterday";
  return daysLeft > 0 ? `in ${daysLeft} days` : `${-daysLeft} days ago`;
}
