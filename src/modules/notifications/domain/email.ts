/** A provider-independent email (§46). HTML is optional; text is always sent. */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Display name for the sender, e.g. "Santos Aircon via Tavi". The address
   * stays TAVI's own (EMAIL_FROM), so no business's domain is spoofed (§I).
   */
  senderName?: string;
  /** Where the customer's reply goes: the business, not TAVI. */
  replyTo?: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The From header: the configured sender, or the given display name on the
 * configured address. The name is user data (a business name), so line
 * breaks and quotes are removed: it can't add headers or break the quoting.
 */
export function fromHeader(configuredFrom: string, senderName: string | undefined): string {
  if (!senderName) return configuredFrom;
  const address = /<([^>]+)>/.exec(configuredFrom)?.[1] ?? configuredFrom.trim();
  const name = senderName.replace(/[\r\n"\\]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return `"${name}" <${address}>`;
}
