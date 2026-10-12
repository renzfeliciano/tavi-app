import { brand } from "@/config/brand";
import { brandSignoffHtml, escapeHtml, type EmailMessage, originOf } from "./email";

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
  /** The business's payment QR codes: each is an image served behind the document's link. */
  paymentQrs?: { label: string; imageUrl: string }[];
};

export function documentLinkEmail(input: DocumentLinkEmailInput): EmailMessage {
  const heading = `${input.title} ${input.number}`;
  const summary = [`${heading}: ${input.total}`, input.dueLine].filter(Boolean).join(" · ");
  const url = escapeHtml(input.url);
  const message = input.message?.trim() || null;
  const C = brand.emailColors;
  const qrs = input.paymentQrs ?? [];
  // Images may be blocked until the reader allows them, so the page link is the fallback.
  const qrHtml =
    qrs.length > 0
      ? `<p style="margin-bottom:4px"><strong>Scan to pay</strong></p><table role="presentation" cellpadding="0" cellspacing="0"><tr>${qrs
          .map(
            (qr) =>
              `<td style="padding:0 12px 8px 0;text-align:center;vertical-align:top;font-size:13px"><img src="${escapeHtml(qr.imageUrl)}" alt="${escapeHtml(
                `${qr.label} QR code`,
              )}" width="140" height="140" style="display:block;border:1px solid ${C.muted}"><span>${escapeHtml(qr.label)}</span></td>`,
          )
          .join("")}</tr></table>`
      : "";
  const qrText = qrs.length > 0 ? `Pay by QR code (${qrs.map((qr) => qr.label).join(", ")}): open the link to scan.` : null;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5">${
    message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""
  }<p><strong>${escapeHtml(input.businessName)}</strong> sent you ${escapeHtml(heading)}.</p><p>${escapeHtml(
    summary,
  )}</p><p><a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:${C.accent};color:${C.onAccent};text-decoration:none">${escapeHtml(
    input.action,
  )}</a></p>${qrHtml}<p style="color:${C.muted};font-size:13px">If the button doesn't work, paste this link into your browser:<br>${url}</p>${brandSignoffHtml(originOf(input.url), "Sent with")}</body></html>`;

  return {
    to: input.to,
    subject: `${heading} from ${input.businessName}`,
    senderName: `${input.businessName} via ${brand.name}`,
    ...(input.businessEmail ? { replyTo: input.businessEmail } : {}),
    text: [message, `${input.businessName} sent you ${heading}.`, summary, `${input.action}: ${input.url}`, qrText]
      .filter(Boolean)
      .join("\n\n"),
    html,
  };
}
