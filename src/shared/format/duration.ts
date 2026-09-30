const UNITS = [
  { seconds: 24 * 60 * 60, name: "day" },
  { seconds: 60 * 60, name: "hour" },
  { seconds: 60, name: "minute" },
] as const;

/**
 * A configured lifetime in words, so copy never restates a number that lives
 * in config ("30 minutes", "7 days"). Uses the largest whole unit, except that
 * a single day reads as "24 hours", the way people say it.
 */
export function describeDuration(seconds: number): string {
  for (const unit of UNITS) {
    if (seconds % unit.seconds !== 0) continue;
    const count = seconds / unit.seconds;
    if (unit.name === "day" && count < 2) continue;
    return `${count} ${unit.name}${count === 1 ? "" : "s"}`;
  }
  return `${seconds} seconds`;
}
