import { eq, or, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { CLOSED_ACCOUNT_NAME, closedAccountEmail } from "../domain/account-closure";
import { accounts, sessions, users, verifications } from "../schema";

/** Records that the user agreed to this version of the documents, now. */
export async function setTermsAccepted(executor: Executor, userId: string, version: string): Promise<void> {
  await executor
    .update(users)
    .set({ termsVersion: version, termsAcceptedAt: sql`now()` })
    .where(eq(users.id, userId));
}

/** What a person's own account holds, for "Download your data". Never selects secrets. */
export async function getAccountForExport(executor: Executor, userId: string) {
  const [row] = await executor
    .select({
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      termsVersion: users.termsVersion,
      termsAcceptedAt: users.termsAcceptedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/**
 * Closes an account: removes the way to sign in (password, every session,
 * pending email links) and replaces the name and email. The row itself stays,
 * because the append-only activity history refers to it. Returns the email it
 * had, or null if the user doesn't exist or is already closed.
 */
export async function anonymiseUser(executor: Executor, userId: string): Promise<string | null> {
  const [user] = await executor
    .select({ email: users.email, closedAt: users.closedAt })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user || user.closedAt) return null;

  await executor.delete(sessions).where(eq(sessions.userId, userId));
  await executor.delete(accounts).where(eq(accounts.userId, userId));
  // Pending links: Better Auth keys them by email, or stores the user ID as the
  // value (password reset: identifier "reset-password:<token>").
  await executor
    .delete(verifications)
    .where(or(eq(verifications.identifier, user.email), eq(verifications.value, userId)));
  await executor
    .update(users)
    .set({
      name: CLOSED_ACCOUNT_NAME,
      email: closedAccountEmail(userId),
      emailVerified: false,
      image: null,
      closedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
  return user.email;
}
