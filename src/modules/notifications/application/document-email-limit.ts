import { and, count, eq, gt } from "drizzle-orm";
import type { Executor } from "@/db";
import {
  DOCUMENT_EMAIL_LIMIT,
  type EmailLimitReason,
  GLOBAL_EMAIL_LIMIT,
  PERSON_EMAIL_LIMIT,
} from "../domain/document-email-limit";
import { outboxMessages } from "../schema";

type Cap = { windowSeconds: number; max: number };

/**
 * Whether this person, acting for this business, may queue more email now,
 * or which cap stops them (§I): the business's own, the person's across all
 * their businesses, or Tavi's as a whole. `null` means go ahead. Commands check
 * it before they change anything, so a refusal leaves no half-done send.
 * `adding` is how many emails the command is about to queue.
 *
 * The business is checked first, then the person, then everyone, so the
 * message names the narrowest cap the person can do something about.
 */
export async function emailLimitReached(
  executor: Executor,
  /** An `OrgActor` fits: the business and the person acting in it. */
  scope: { organizationId: string; userId: string },
  now: Date = new Date(),
  adding = 1,
): Promise<EmailLimitReason | null> {
  const queuedSince = async (cap: Cap, where?: ReturnType<typeof eq>) => {
    const since = new Date(now.getTime() - cap.windowSeconds * 1000);
    const [row] = await executor
      .select({ queued: count() })
      .from(outboxMessages)
      .where(where ? and(where, gt(outboxMessages.createdAt, since)) : gt(outboxMessages.createdAt, since));
    return row?.queued ?? 0;
  };

  const checks: [EmailLimitReason, Cap, ReturnType<typeof eq> | undefined][] = [
    ["business", DOCUMENT_EMAIL_LIMIT, eq(outboxMessages.organizationId, scope.organizationId)],
    ["person", PERSON_EMAIL_LIMIT, eq(outboxMessages.actorUserId, scope.userId)],
    ["global", GLOBAL_EMAIL_LIMIT, undefined],
  ];
  for (const [reason, cap, where] of checks) {
    if ((await queuedSince(cap, where)) + adding > cap.max) return reason;
  }
  return null;
}
