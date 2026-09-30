import { and, desc, eq, gt, ne } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { sessions } from "../schema";

/** Records which organization this session is acting in (server-side only, §D). */
export async function setSessionActiveOrganization(
  sessionId: string,
  organizationId: string,
  db: Database = getDb(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessions.id, sessionId));
}

export type ActiveSession = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
};

/** The user's signed-in devices. Tokens are never selected. */
export async function listActiveSessions(
  userId: string,
  db: Database = getDb(),
): Promise<ActiveSession[]> {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastActiveAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt));
}

/** Signs out one device, only if it belongs to `userId`. Returns whether it did. */
export async function revokeSessionForUser(
  userId: string,
  sessionId: string,
  db: Database = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  return deleted.length > 0;
}

/** Signs out every device except the current one. Returns how many ended. */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
  db: Database = getDb(),
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id });
  return deleted.length;
}
