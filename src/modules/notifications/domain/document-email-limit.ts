import { describeDuration } from "@/shared/format/duration";

// A cap on the emails one business can have TAVI send (§I): enough for a
// busy day, low enough that a signed-up spammer can't use our sending domain
// (and its reputation) for bursts. Counted from the business's outbox rows,
// so only emails that were actually queued count. Founder's number, 2026-10-02.
export const DOCUMENT_EMAIL_LIMIT = { windowSeconds: 60 * 60, max: 50 } as const;

/** "You've reached the limit of 50 emails in 1 hour. Copy the link instead, or try again later." */
export function documentEmailLimitMessage(alternative = "Copy the link instead"): string {
  const { max, windowSeconds } = DOCUMENT_EMAIL_LIMIT;
  return `You've reached the limit of ${max} emails in ${describeDuration(windowSeconds)}. ${alternative}, or try again later.`;
}
