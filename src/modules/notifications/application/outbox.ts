import { and, asc, eq, lte } from "drizzle-orm";
import { type Database, type Executor, getDb } from "@/db";
import { redact } from "@/shared/logger";
import type { EmailMessage, EmailSender } from "../domain/email";
import { nextAttemptAt } from "../domain/retry";
import { getEmailSender } from "../infra/transport";
import { outboxMessages } from "../schema";

/**
 * Queues an email in the caller's transaction, so it exists if (and only if)
 * the business change that caused it commits.
 */
export async function enqueueEmail(
  executor: Executor,
  message: EmailMessage,
  options: { organizationId?: string | null } = {},
): Promise<void> {
  await executor.insert(outboxMessages).values({
    kind: "email",
    organizationId: options.organizationId ?? null,
    payload: message,
  });
}

export type DispatchResult = { sent: number; retrying: number; failed: number };

type DispatchOptions = {
  db?: Database;
  sender?: EmailSender;
  now?: () => Date;
  /** Messages per run; small, because rows stay locked while sending. */
  limit?: number;
};

function isEmailMessage(value: unknown): value is EmailMessage {
  const v = value as Partial<EmailMessage> | null;
  return !!v && typeof v.to === "string" && typeof v.subject === "string" && typeof v.text === "string";
}

function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return (redact(text) as string).slice(0, 500);
}

/**
 * Sends due emails. Rows are claimed with FOR UPDATE SKIP LOCKED, so
 * overlapping runs (cron plus a post-request flush) never send one twice.
 */
export async function dispatchOutbox(options: DispatchOptions = {}): Promise<DispatchResult> {
  const db = options.db ?? getDb();
  const sender = options.sender ?? getEmailSender();
  const now = options.now ?? (() => new Date());
  const result: DispatchResult = { sent: 0, retrying: 0, failed: 0 };

  await db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(outboxMessages)
      .where(and(eq(outboxMessages.status, "pending"), lte(outboxMessages.nextAttemptAt, now())))
      .orderBy(asc(outboxMessages.createdAt))
      .limit(options.limit ?? 25)
      .for("update", { skipLocked: true });

    for (const row of due) {
      const attempts = row.attempts + 1;
      try {
        if (!isEmailMessage(row.payload)) throw new Error("Malformed outbox payload");
        await sender.send(row.payload);
        await tx
          .update(outboxMessages)
          .set({
            status: "sent",
            attempts,
            sentAt: now(),
            lastError: null,
            payload: { to: row.payload.to, subject: row.payload.subject },
          })
          .where(eq(outboxMessages.id, row.id));
        result.sent++;
      } catch (error) {
        const retryAt = isEmailMessage(row.payload) ? nextAttemptAt(attempts, now()) : null;
        await tx
          .update(outboxMessages)
          .set(
            retryAt
              ? { attempts, nextAttemptAt: retryAt, lastError: describeError(error) }
              : { status: "failed", attempts, lastError: describeError(error) },
          )
          .where(eq(outboxMessages.id, row.id));
        if (retryAt) result.retrying++;
        else result.failed++;
      }
    }
  });

  return result;
}
