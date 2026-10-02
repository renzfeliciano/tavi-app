import "server-only";
import { getDb, type Database } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { acceptedTermsVersion } from "../domain/terms";
import { setTermsAccepted } from "../infra/user-repository";

export type AcceptTermsResult = { ok: true } | { ok: false; error: "stale_version" };

/**
 * A signed-in person agrees to the current Terms of Service and Privacy
 * Notice (after a material change, D15). The version must be exactly the
 * current one, as at sign-up; the time is the server's.
 */
export async function acceptTerms(
  userId: string,
  version: unknown,
  db: Database = getDb(),
): Promise<AcceptTermsResult> {
  const termsVersion = acceptedTermsVersion(version);
  if (!termsVersion) return { ok: false, error: "stale_version" };
  await db.transaction(async (tx) => {
    await setTermsAccepted(tx, userId, termsVersion);
    await recordAuditEvent(tx, {
      action: "auth.terms_accepted",
      actorType: "user",
      actorId: userId,
      entityType: "user",
      entityId: userId,
      metadata: { termsVersion },
    });
  });
  return { ok: true };
}
