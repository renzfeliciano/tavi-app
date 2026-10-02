import "server-only";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/modules/system";
import { ACCOUNT_CLOSURE_RATE_LIMIT } from "../domain/account-closure";
import { getAuth } from "../infra/auth";
import { requireSession } from "./request-context";

export type PasswordCheck = "ok" | "wrong" | "rate_limited";

/**
 * Re-checks the signed-in person's password before an irreversible change to
 * their account (closing it). Server-side Better Auth calls skip its rate
 * limits, so this one has its own, per person.
 */
export async function confirmCurrentPassword(password: unknown): Promise<PasswordCheck> {
  const { user } = await requireSession();
  const limit = await consumeRateLimit(`account-close:${user.id}`, ACCOUNT_CLOSURE_RATE_LIMIT);
  if (!limit.allowed) return "rate_limited";
  if (typeof password !== "string" || password.length === 0) return "wrong";
  try {
    await getAuth().api.verifyPassword({ body: { password }, headers: await headers() });
    return "ok";
  } catch {
    return "wrong";
  }
}
