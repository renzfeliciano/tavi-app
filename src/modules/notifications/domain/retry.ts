// Outbox retries (§47): quick first retries for blips, then slower ones for
// provider outages. After the last attempt the message is marked failed and
// surfaces in monitoring instead of retrying forever.
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

/** When to retry after `attempts` failures, or null to give up. */
export function nextAttemptAt(attempts: number, now: Date): Date | null {
  const delay = BACKOFF_MINUTES[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay * 60_000);
}
