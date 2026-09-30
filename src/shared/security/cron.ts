import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Checks Vercel Cron's `Authorization: Bearer <CRON_SECRET>` header in
 * constant time (hashing first makes the lengths equal). With no secret
 * configured, nothing is authorized.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
