// Session lifetimes (docs/foundation-proposal.md §D, D23). Better Auth enforces
// the sliding idle timeout and renewal on the server; the absolute cap is
// enforced by `requireSession`, because Better Auth's expiry slides with
// activity. The browser also watches for idleness (IdleGuard) so an unattended
// screen signs itself out and says why, instead of waiting for the next click.
export const SESSION_POLICY = {
  /** Signed out after 30 minutes without activity. */
  idleTimeoutSeconds: 30 * 60,
  /** Expiry is pushed forward at most once every 5 minutes of activity, so reads rarely write. */
  renewAfterSeconds: 5 * 60,
  /** The browser warns this long before it signs the person out. */
  idleWarningSeconds: 60,
  /** Hard re-login 30 days after sign-in, however active the session is. */
  absoluteLifetimeSeconds: 30 * 24 * 60 * 60,
  /** Sensitive changes (password, email, deleting the org) need a sign-in this recent. */
  freshAuthSeconds: 15 * 60,
} as const;

/**
 * How long the browser lets a screen sit idle. The server only renews every
 * `renewAfterSeconds`, so the browser gives up that much earlier: it never
 * keeps a screen open on a session the server has already ended.
 */
export function clientIdleLimitMs(): number {
  return (SESSION_POLICY.idleTimeoutSeconds - SESSION_POLICY.renewAfterSeconds) * 1000;
}

export type IdleStatus = { status: "active" } | { status: "warning"; remainingMs: number } | { status: "expired" };

export function idleStatus({
  lastActivityAt,
  now,
  limitMs,
  warningMs,
}: {
  lastActivityAt: number;
  now: number;
  limitMs: number;
  warningMs: number;
}): IdleStatus {
  // A clock that jumped backwards counts as activity, never as a reason to sign out.
  const idle = Math.max(0, now - lastActivityAt);
  if (idle >= limitMs) return { status: "expired" };
  if (idle >= limitMs - warningMs) return { status: "warning", remainingMs: limitMs - idle };
  return { status: "active" };
}

export function isPastAbsoluteLifetime(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= SESSION_POLICY.absoluteLifetimeSeconds * 1000;
}
