import { z } from "zod";
import { type CalendarDate, compareDates } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";
import type { QuoteStatus } from "./status";
import { transitionQuote } from "./transitions";

// The customer's decision on a quote from its link (§B.3, §G.4): approve with
// a typed name and the terms accepted, or decline with an optional reason.

export const QUOTE_DECISION_LIMITS = { name: 120, reason: 500 } as const;

export type RawQuoteDecision =
  | { kind: "approve"; name: string; accepted: boolean }
  | { kind: "reject"; reason: string };

export type QuoteDecision = { kind: "approve"; name: string } | { kind: "reject"; reason: string | null };

export type QuoteDecisionResult =
  | { ok: true; decision: QuoteDecision }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; malformed: true };

// The shape the quote page posts. Anyone with the link can post anything, so
// it's checked here rather than assumed (§I); the terms box counts only when
// it is literally `true`.
const rawDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve"), name: z.string(), accepted: z.boolean() }),
  z.object({ kind: z.literal("reject"), reason: z.string() }),
]);

export function parseQuoteDecision(input: unknown): QuoteDecisionResult {
  const shape = rawDecisionSchema.safeParse(input);
  if (!shape.success) return { ok: false, malformed: true };
  const raw: RawQuoteDecision = shape.data;
  if (raw.kind === "reject") {
    const reason = raw.reason.trim();
    if (reason.length > QUOTE_DECISION_LIMITS.reason) {
      return { ok: false, errors: { reason: tooLong(QUOTE_DECISION_LIMITS.reason) } };
    }
    return { ok: true, decision: { kind: "reject", reason: reason || null } };
  }
  const name = raw.name.trim();
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter your name.";
  else if (name.length > QUOTE_DECISION_LIMITS.name) errors.name = tooLong(QUOTE_DECISION_LIMITS.name);
  if (!raw.accepted) errors.accepted = "Tick the box to accept the quote's terms.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, decision: { kind: "approve", name } };
}

export type QuoteDecisionCheck = { ok: true } | { ok: false; reason: "expired" | "closed" };

/**
 * Whether the customer can still decide. The command re-checks the date
 * itself, so a quote is never approved after its valid-until date even if
 * the daily expiry job hasn't run yet (§B.3).
 */
export function quoteDecisionCheck(
  quote: { status: QuoteStatus; validUntil: CalendarDate },
  event: "approve" | "reject",
  today: CalendarDate,
): QuoteDecisionCheck {
  if (!transitionQuote(quote.status, event).ok) return { ok: false, reason: "closed" };
  if (compareDates(quote.validUntil, today) < 0) return { ok: false, reason: "expired" };
  return { ok: true };
}

/**
 * A stable text form of what the customer saw (keys sorted at every level),
 * hashed and stored with an approval so it binds to that exact content.
 */
export function canonicalQuoteContent(content: unknown): string {
  return JSON.stringify(sortKeys(content));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}
