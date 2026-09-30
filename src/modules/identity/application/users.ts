import { and, eq, inArray } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { users } from "../schema";

/** The confirmed email addresses of these users (unconfirmed ones never get business email). */
export async function listVerifiedEmails(userIds: string[], db: Database = getDb()): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(inArray(users.id, userIds), eq(users.emailVerified, true)));
  const byId = new Map(rows.map((row) => [row.id, row.email]));
  return userIds.flatMap((id) => byId.get(id) ?? []);
}
