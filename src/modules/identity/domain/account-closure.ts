// Closing an account (proposal §M 1.13c, D16). The user row stays, because
// the append-only activity history points at it, but nothing that identifies
// the person is left on it.

export const CLOSED_ACCOUNT_NAME = "Closed account";

/**
 * A unique address that can never receive mail (RFC 2606 `.invalid`), so the
 * person's real address is free to sign up again.
 */
export function closedAccountEmail(userId: string): string {
  return `closed-${userId}@closed.invalid`;
}

/** Password attempts on the close-account form, per person. */
export const ACCOUNT_CLOSURE_RATE_LIMIT = { windowSeconds: 15 * 60, max: 5 } as const;
