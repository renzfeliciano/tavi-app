import { lt, sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { requestLimits } from "../schema";

export type RateLimitRule = { windowSeconds: number; max: number };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Counts one request against `key` in a fixed window, atomically: one upsert
 * that either increments the current window or starts a new one. Both CASE
 * expressions read the row's previous values, so concurrent requests can't
 * double-reset or undercount.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowExpired = sql`${requestLimits.windowStart} <= ${new Date(now.getTime() - rule.windowSeconds * 1000)}::timestamptz`;

  const [row] = await db
    .insert(requestLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: requestLimits.key,
      set: {
        count: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${requestLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${windowExpired} THEN ${now}::timestamptz ELSE ${requestLimits.windowStart} END`,
      },
    })
    .returning();
  if (!row) throw new Error("Rate limit upsert returned no row");

  const allowed = row.count <= rule.max;
  const windowEndsAt = row.windowStart.getTime() + rule.windowSeconds * 1000;
  return {
    allowed,
    remaining: Math.max(0, rule.max - row.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000)),
  };
}

/** Deletes counters whose window started over a day ago. Returns how many. */
export async function pruneRateLimits(db: Database = getDb(), now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(requestLimits)
    .where(lt(requestLimits.windowStart, new Date(now.getTime() - 86_400_000)))
    .returning({ key: requestLimits.key });
  return deleted.length;
}
