import { tooLong } from "@/shared/validation/messages";

// The business's payment QR codes: what a customer scans to pay (a GCash,
// Maya or bank QR, or a payment link). The business gives Tavi the text inside
// the QR (a link, or a QR Ph / EMVCo payload) and Tavi draws it clean on the
// quote, invoice, PDF and email. No image is stored, and the code never
// carries an amount: it's the same code on every document.

export const PAYMENT_QR_LIMITS = { count: 3, label: 30, value: 1000 } as const;

export type PaymentQr = {
  /** What the customer sees under the code, e.g. "GCash". */
  label: string;
  /** The text inside the QR: an https link or a QR Ph (EMVCo) payload. */
  value: string;
  /** Shown on documents when on; kept in Settings when off. */
  enabled: boolean;
};

export type RawPaymentQr = { label: string; value: string; enabled?: boolean };

export type PaymentQrsResult = { ok: true; qrs: PaymentQr[] } | { ok: false; errors: Record<string, string> };

/** CRC-16/CCITT-FALSE, the checksum that ends every EMVCo QR payload (tag 63). */
function crc16(text: string): number {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/** Whether an EMVCo payload ends in a correct CRC: a typo or a cut-off copy fails. */
export function emvCrcValid(payload: string): boolean {
  if (payload.length < 8 || payload.slice(-8, -4) !== "6304") return false;
  return crc16(payload.slice(0, -4)).toString(16).toUpperCase().padStart(4, "0") === payload.slice(-4).toUpperCase();
}

export type QrValueKind = "link" | "payload" | "text";

export function classifyQrValue(value: string): QrValueKind {
  if (value.startsWith("000201")) return "payload";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "link";
  return "text";
}

function valueProblem(value: string): string | null {
  if (value.length > PAYMENT_QR_LIMITS.value) return tooLong(PAYMENT_QR_LIMITS.value);
  if (/[\u0000-\u001f\u007f]/.test(value)) return "That has line breaks or characters a QR code can't hold.";
  const kind = classifyQrValue(value);
  if (kind === "payload") {
    // Merchant names inside a payload can hold spaces, so only the checksum is checked.
    return emvCrcValid(value) ? null : "That code looks incomplete or copied wrongly. Paste it again, or upload the QR image.";
  }
  if (kind === "link") {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname && !url.username && !url.password && !/\s/.test(value)) return null;
    } catch {
      // falls through to the message below
    }
    return "Use a link that starts with https://, without spaces, a username or a password.";
  }
  return null;
}

/** The QRs as the Settings form sends them: trimmed, blank rows dropped, each checked. */
export function parsePaymentQrs(raw: RawPaymentQr[]): PaymentQrsResult {
  const errors: Record<string, string> = {};
  const qrs: PaymentQr[] = [];
  const rows = raw.map((row) => ({ label: row.label.trim(), value: row.value.trim(), enabled: row.enabled ?? true }));
  const filled = rows.filter((row) => row.label !== "" || row.value !== "");

  if (filled.length > PAYMENT_QR_LIMITS.count) errors.form = `Add up to ${PAYMENT_QR_LIMITS.count} payment QR codes.`;

  filled.forEach((row, index) => {
    if (row.label === "") errors[`${index}.label`] = "Name this QR, e.g. GCash.";
    else if (row.label.length > PAYMENT_QR_LIMITS.label) errors[`${index}.label`] = tooLong(PAYMENT_QR_LIMITS.label);
    if (row.value === "") errors[`${index}.value`] = "Paste the payment link or the QR's code.";
    else {
      const problem = valueProblem(row.value);
      if (problem) errors[`${index}.value`] = problem;
    }
    qrs.push(row);
  });

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, qrs };
}
