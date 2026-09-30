import { type Database, getDb } from "@/db";
import { getOutboxStats, type OutboxStats } from "@/modules/notifications";

export type Readiness = {
  ok: boolean;
  database: "ok" | "error";
  outbox: OutboxStats;
};

/** Can this instance serve traffic? A cheap query that also reads the outbox backlog. */
export async function checkReadiness(db: Database = getDb()): Promise<Readiness> {
  try {
    const outbox = await getOutboxStats(db);
    return { ok: true, database: "ok", outbox };
  } catch {
    return { ok: false, database: "error", outbox: { pending: 0, failed: 0, oldestPendingSeconds: 0 } };
  }
}
