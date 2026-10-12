import { z } from "zod";

/** At most this many people get one payment acknowledgement. */
export const MAX_ACK_RECIPIENTS = 5;
const MAX_EMAIL_LENGTH = 254;

export type AckRecipientsResult = { ok: true; emails: string[] } | { ok: false; error: string };

/**
 * Checks who a payment acknowledgement goes to: trimmed, lower-cased, de-duplicated,
 * each a valid address, and no more than `MAX_ACK_RECIPIENTS`. An empty list is fine
 * (record it without emailing).
 */
export function parseAckRecipients(raw: readonly string[]): AckRecipientsResult {
  const emails: string[] = [];
  for (const value of raw) {
    const email = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!email) continue;
    if (email.length > MAX_EMAIL_LENGTH || !z.email().safeParse(email).success) {
      return { ok: false, error: `"${email.slice(0, 60)}" isn't a valid email address.` };
    }
    if (!emails.includes(email)) emails.push(email);
  }
  if (emails.length > MAX_ACK_RECIPIENTS) {
    return { ok: false, error: `Send it to ${MAX_ACK_RECIPIENTS} people at most.` };
  }
  return { ok: true, emails };
}
