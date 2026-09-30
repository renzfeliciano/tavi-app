import { desc, eq } from "drizzle-orm";
import { type Database, type Executor, getDb } from "@/db";
import { redact } from "@/shared/logger";
import type { AuditEventInput } from "../domain/events";
import { auditEvents } from "../schema";

/**
 * Appends an audit event. Pass the transaction that makes the business change,
 * so the event and the change commit (or roll back) together.
 */
export async function recordAuditEvent(executor: Executor, event: AuditEventInput): Promise<void> {
  await executor.insert(auditEvents).values({
    action: event.action,
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    organizationId: event.organizationId ?? null,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    metadata: redact(event.metadata ?? {}) as Record<string, unknown>,
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
  });
}

/** An organization's history, newest first. */
export async function listAuditEvents(
  organizationId: string,
  db: Database = getDb(),
  limit = 50,
) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit);
}
