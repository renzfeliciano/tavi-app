import { z } from "zod";
import { tooLong } from "@/shared/validation/messages";

// How a quote or invoice goes out from the send dialog (§G.3): by email from
// TAVI, or as a link the business pastes into a chat. The choice arrives from
// the browser, so the server checks its shape and limits here (§I) instead of
// relying on the form; the dialog reads the same limits.

export const DELIVERY_LIMITS = {
  /** RFC 5321's longest forward path. */
  emailTo: 254,
  message: 2000,
} as const;

export type RawDelivery = { mode: "email"; to: string; message: string } | { mode: "link" };

export type DeliveryEmail = { to: string; message: string };

export type DeliveryResult =
  | { ok: true; email: DeliveryEmail | null }
  | { ok: false; errors: { emailTo: string } }
  | { ok: false; error: string };

const deliverySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("link") }),
  z.object({ mode: z.literal("email"), to: z.string(), message: z.string() }),
]);

/** Checks the send dialog's choice; returns the email to queue, or null for "copy link". */
export function parseDelivery(raw: unknown): DeliveryResult {
  const parsed = deliverySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Choose how to send it, then try again." };
  if (parsed.data.mode === "link") return { ok: true, email: null };

  const to = parsed.data.to.trim().toLowerCase();
  if (to.length > DELIVERY_LIMITS.emailTo || !z.email().safeParse(to).success) {
    return { ok: false, errors: { emailTo: "Enter a valid email address." } };
  }
  if (parsed.data.message.length > DELIVERY_LIMITS.message) {
    return { ok: false, error: `Shorten the message. ${tooLong(DELIVERY_LIMITS.message)}` };
  }
  return { ok: true, email: { to, message: parsed.data.message } };
}
