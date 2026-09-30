import { brand } from "@/config/brand";
import { escapeHtml, type EmailMessage } from "./email";

// The email a customer gets with a quote or invoice. It's from the business
// ("Santos Aircon via Tavi"), replies go to the business, and the link is the
// point: the document itself lives on the customer's page, not in the email.

export type DocumentLinkEmailInput = {
  to: string;
  businessName: string;
  businessEmail: string | null;
  /** e.g. "Quotation". */
  title: string;
  number: string;
  /** Already formatted, e.g. "₱3,450.00". */
  total: string;
  /** e.g. "Valid until Oct 15, 2026" or "Due Oct 15, 2026". */
  dueLine: string | null;
  /** The business's own message; plain text. */
  message: string | null;
  url: string;
  /** Button label, e.g. "View and approve". */
  action: string;
};

export function documentLinkEmail(input: DocumentLinkEmailInput): EmailMessage {
  const heading = `${input.title} ${input.number}`;
  const summary = [`${heading}: ${input.total}`, input.dueLine].filter(Boolean).join(" · ");
  const url = escapeHtml(input.url);
  const message = input.message?.trim() || null;
  const C = brand.emailColors;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5">${
    message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""
  }<p><strong>${escapeHtml(input.businessName)}</strong> sent you ${escapeHtml(heading)}.</p><p>${escapeHtml(
    summary,
  )}</p><p><a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:${C.accent};color:${C.onAccent};text-decoration:none">${escapeHtml(
    input.action,
  )}</a></p><p style="color:${C.muted};font-size:13px">If the button doesn't work, paste this link into your browser:<br>${url}</p><p style="color:${C.muted};font-size:12px">Sent with ${escapeHtml(
    brand.name,
  )}</p></body></html>`;

  return {
    to: input.to,
    subject: `${heading} from ${input.businessName}`,
    senderName: `${input.businessName} via ${brand.name}`,
    ...(input.businessEmail ? { replyTo: input.businessEmail } : {}),
    text: [message, `${input.businessName} sent you ${heading}.`, summary, `${input.action}: ${input.url}`]
      .filter(Boolean)
      .join("\n\n"),
    html,
  };
}
