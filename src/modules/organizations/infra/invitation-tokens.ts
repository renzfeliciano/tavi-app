import { createHash, randomBytes } from "node:crypto";
import { INVITATION_TOKEN_PATTERN } from "../domain/team";

const TOKEN_BYTES = 32; // 256 bits, like customer links

/** A new invitation token: the email gets the token, the database only its hash. */
export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check before touching the database. */
export function looksLikeInvitationToken(value: unknown): value is string {
  return typeof value === "string" && INVITATION_TOKEN_PATTERN.test(value);
}
