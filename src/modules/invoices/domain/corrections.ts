import { tooLong } from "@/shared/validation/messages";

// Correcting an issued invoice (§B.4, D6–D7): editing before any payment,
// void (issued in error) and cancel (the sale was called off), each with a
// reason kept in the record.

export const INVOICE_REASON_MAX = 500;

export function parseInvoiceReason(raw: string): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = raw.trim();
  if (!reason) return { ok: false, error: "Give a reason. It's kept with the record." };
  if (reason.length > INVOICE_REASON_MAX) return { ok: false, error: tooLong(INVOICE_REASON_MAX) };
  return { ok: true, reason };
}

const REISSUE = "Void this one and create a new one instead.";

/** RMC 98-2026 Sec. IV.8: an issued invoice "shall not be deleted, altered, or modified" (D14). */
export const REGISTERED_INVOICE_LOCKED =
  "A registered invoice can't be changed once issued. Use void & duplicate to issue a corrected one.";

type IssuedForEdit = { amountPaidMinor: number; registration: object | null };

/** Whether a sent invoice may still be edited in place: a billing statement with no payments (D7, D14). */
export function canEditIssued(current: IssuedForEdit): boolean {
  return current.registration === null && current.amountPaidMinor === 0;
}

/**
 * Why an edit to a sent invoice can't be saved; empty when it can. The
 * customer and currency stay as issued, and any payment locks it (D7).
 */
export function issuedEditProblems(
  current: { customerId: string | null; currency: string } & IssuedForEdit,
  next: { customerId: string | null; currency: string; lineCount: number },
): Record<string, string> {
  if (current.registration !== null) return { form: REGISTERED_INVOICE_LOCKED };
  if (current.amountPaidMinor > 0) {
    return { form: "A payment is recorded, so this can't be edited. Void the payment first, or use void & duplicate." };
  }
  const problems: Record<string, string> = {};
  if (next.customerId !== current.customerId) problems.customerId = `The customer can't change once sent. ${REISSUE}`;
  if (next.currency !== current.currency) problems.currency = `The currency can't change once sent. ${REISSUE}`;
  if (next.lineCount === 0) problems.lines = "Keep at least one item.";
  return problems;
}
