// Session lifetimes (docs/foundation-proposal.md §D). Better Auth enforces the
// sliding idle timeout and renewal; the absolute cap is enforced by
// `requireSession`, because Better Auth's expiry slides with activity.
export const SESSION_POLICY = {
  /** Signed out after 7 days without activity. */
  idleTimeoutSeconds: 7 * 24 * 60 * 60,
  /** Expiry is pushed forward at most once a day, so reads don't write. */
  renewAfterSeconds: 24 * 60 * 60,
  /** Hard re-login 30 days after sign-in, however active the session is. */
  absoluteLifetimeSeconds: 30 * 24 * 60 * 60,
  /** Sensitive changes (password, email, deleting the org) need a sign-in this recent. */
  freshAuthSeconds: 15 * 60,
} as const;

export function isPastAbsoluteLifetime(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= SESSION_POLICY.absoluteLifetimeSeconds * 1000;
}
