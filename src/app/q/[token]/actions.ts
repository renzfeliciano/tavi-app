"use server";

import { headers } from "next/headers";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { decideSharedQuote, type RawQuoteDecision } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { env } from "@/shared/env";
import { clientIp } from "@/shared/http/client-ip";

/** Approve/decline attempts per IP per minute (§I). */
const DECISION_RATE_LIMIT = { windowSeconds: 60, max: 10 };

export type DecisionResponse =
  | { ok: true; status: "APPROVED" | "REJECTED" }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

/**
 * The customer's approve or decline, posted from the quote's page. The token
 * is the only authorization; the content hash ties the decision to what the
 * page showed. Locale for the expiry date comes from the page (the business's).
 */
export async function decideQuoteAction(
  token: string,
  decision: RawQuoteDecision,
  contentHash: string,
  locale: string,
): Promise<DecisionResponse> {
  const requestHeaders = await headers();
  const ipAddress = clientIp(requestHeaders);
  const limit = await consumeRateLimit(`portal-decision:${ipAddress}`, DECISION_RATE_LIMIT);
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Wait a minute, then try again." };

  const result = await decideSharedQuote(token, decision, {
    contentHash,
    ipAddress: ipAddress === "unknown" ? null : ipAddress,
    userAgent: requestHeaders.get("user-agent"),
    appUrl: env.APP_URL,
  });
  if (result.ok) {
    flushOutboxAfterResponse();
    return result;
  }
  if ("errors" in result) return result;
  switch (result.reason) {
    case "expired": {
      let date: string = result.validUntil;
      try {
        date = formatCalendarDate(result.validUntil, locale);
      } catch {
        // An unexpected locale from the page falls back to the ISO date.
      }
      return { ok: false, error: `This quote expired on ${date}. Ask the business for an updated quote.` };
    }
    case "changed":
      return { ok: false, error: "This quote has changed since you opened it. Reload the page to see the latest version." };
    case "closed":
      return { ok: false, error: "This quote has already been answered or is no longer open. Reload the page to see where it stands." };
    default:
      return { ok: false, error: "This link isn't available any more. Ask the business to send you the latest link." };
  }
}
