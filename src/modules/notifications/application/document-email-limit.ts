import { and, count, eq, gt } from "drizzle-orm";
import type { Executor } from "@/db";
import { DOCUMENT_EMAIL_LIMIT } from "../domain/document-email-limit";
import { outboxMessages } from "../schema";

/**
 * Whether this business may queue another email now: fewer than
 * `DOCUMENT_EMAIL_LIMIT.max` queued in the last window (§I). Commands check it
 * before they change anything, so a refusal leaves no half-done send.
 */
export async function documentEmailsAllowed(
  executor: Executor,
  organizationId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - DOCUMENT_EMAIL_LIMIT.windowSeconds * 1000);
  const [row] = await executor
    .select({ queued: count() })
    .from(outboxMessages)
    .where(and(eq(outboxMessages.organizationId, organizationId), gt(outboxMessages.createdAt, since)));
  return (row?.queued ?? 0) < DOCUMENT_EMAIL_LIMIT.max;
}
