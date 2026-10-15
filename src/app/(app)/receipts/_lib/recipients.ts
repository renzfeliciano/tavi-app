import { parseAckRecipients } from "@/modules/payments/client";

export type AddRecipientResult = { ok: true; extras: string[] } | { ok: false; error: string };

/**
 * Adds a typed address to the people a receipt is also sent to. `fixed` are addresses already counted (the
 * customer's), so they aren't added twice but do count toward the limit. An empty draft changes nothing.
 */
export function addRecipient(draft: string, extras: readonly string[], fixed: readonly string[]): AddRecipientResult {
  const typed = draft.trim();
  if (!typed) return { ok: true, extras: [...extras] };
  const checked = parseAckRecipients([typed]);
  if (!checked.ok) return checked;
  const email = checked.emails[0] ?? typed;
  const next = extras.includes(email) || fixed.includes(email) ? [...extras] : [...extras, email];
  const total = parseAckRecipients([...fixed, ...next]);
  return total.ok ? { ok: true, extras: next } : total;
}
