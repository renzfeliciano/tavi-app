import { sql } from "drizzle-orm";
import { type Database, getDb } from "@/db";
import { outboxMessages } from "../schema";

export type OutboxStats = { pending: number; failed: number; oldestPendingSeconds: number };

/** Backlog numbers for health checks and alerts (§K). */
export async function getOutboxStats(db: Database = getDb()): Promise<OutboxStats> {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${outboxMessages.status} = 'pending')::int`,
      failed: sql<number>`count(*) filter (where ${outboxMessages.status} = 'failed')::int`,
      oldestPendingSeconds: sql<number>`coalesce(extract(epoch from now() - min(${outboxMessages.createdAt}) filter (where ${outboxMessages.status} = 'pending')), 0)::int`,
    })
    .from(outboxMessages);
  return row ?? { pending: 0, failed: 0, oldestPendingSeconds: 0 };
}
