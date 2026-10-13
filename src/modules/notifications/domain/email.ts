import { brand } from "@/config/brand";
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

/** The web address (scheme and host) a link points to, or null when it isn't a web link. */
export function originOf(url: string): string | null {
  try {
    const { protocol, origin } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? origin : null;
  } catch {
    return null;
  }
}

/**
 * The wordmark's picture and the size it is shown at: a third of its pixel size,
 * for sharp 3x screens (`npm run brand:build` makes it, sides in multiples of 3;
 * a test keeps the two in step). `drop` is how far the letters' baseline sits above
 * the picture's bottom edge, so the picture can hang that far below the words'
 * baseline and the letters line up with them.
 */
const WORDMARK = { path: "/icons/tavi-email-wordmark.png", width: 41, height: 18, drop: 3 } as const;

/**
 * The foot of an email, on one line: "Sent with" and the TAVI wordmark alone (mail
 * clients can't draw SVG or CSS, so it is a PNG in `public/icons`, served from the
 * app). With no address to load it from, it falls back to the name in text.
 */
export function brandSignoffHtml(origin: string | null, lead: string): string {
  const style = `margin:24px 0 0;color:${brand.emailColors.muted};font-size:12px;line-height:20px`;
  if (!origin) return `<p style="${style}">${escapeHtml(`${lead} ${brand.name}`)}</p>`;
  const src = escapeHtml(`${origin}${WORDMARK.path}`);
  const picture = `<img src="${src}" alt="${escapeHtml(brand.name)}" width="${WORDMARK.width}" height="${WORDMARK.height}" style="border:0;vertical-align:-${WORDMARK.drop}px">`;
  return `<p style="${style}">${escapeHtml(lead)} ${picture}</p>`;
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
