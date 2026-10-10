/**
 * Tells the companion that the sign-in greeting is on screen, so the two never
 * share the corner: the companion waits until the greeting has left.
 */
let until = 0;

export function holdCornerUntil(timestamp: number): void {
  until = Math.max(until, timestamp);
}

/** Milliseconds until the corner is free (0 when it already is). */
export function cornerBusyFor(now: number = Date.now()): number {
  return Math.max(0, until - now);
}
