import { brand } from "@/config/brand";
import { describeDuration } from "@/shared/format/duration";

// Caps on the emails TAVI sends for people (§I). Counted from the outbox rows,
// so only emails that were actually queued count.
//
// One business: enough for a busy day, low enough that a signed-up spammer
// can't use our sending domain (and its reputation) for bursts. Founder's
// number, 2026-10-02.
export const DOCUMENT_EMAIL_LIMIT = { windowSeconds: 60 * 60, max: 50 } as const;

// One person, across every business they belong to. Without it, a person
// could open several businesses and multiply the cap above. Security review,
// October 2026; a little over one business's cap, so one busy business is
// never held back by it.
export const PERSON_EMAIL_LIMIT = { windowSeconds: 60 * 60, max: 80 } as const;

// Everyone together. The free Gmail account behind TAVI's mail (D11) has one
// sending quota for all businesses, so a few accounts at their own caps could
// use it up. Raise this when mail moves to a domain with its own provider.
export const GLOBAL_EMAIL_LIMIT = { windowSeconds: 60 * 60, max: 150 } as const;

/** Which cap was hit: the business's own, the person's across businesses, or TAVI's as a whole. */
export type EmailLimitReason = "business" | "person" | "global";

/** "You've reached the limit of 50 emails in 1 hour. Copy the link instead, or try again later." */
export function documentEmailLimitMessage(
  alternative = "Copy the link instead",
  reason: EmailLimitReason = "business",
): string {
  if (reason === "global") {
    return `${brand.name} is sending a lot of email right now. ${alternative}, or try again in a little while.`;
  }
  const { max, windowSeconds } = reason === "person" ? PERSON_EMAIL_LIMIT : DOCUMENT_EMAIL_LIMIT;
  const scope = reason === "person" ? " across your businesses" : "";
  return `You've reached the limit of ${max} emails in ${describeDuration(windowSeconds)}${scope}. ${alternative}, or try again later.`;
}
