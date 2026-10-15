import { brand } from "@/config/brand";
import { brandSignoffHtml, escapeHtml, type EmailMessage, originOf } from "./email";

// A purchase order a business emails its supplier (docs/superpowers/specs/2026-10-15-purchase-orders-design.md, P9).
// It carries the order's details; the PDF is downloaded by the business
// and is not attached. It is a supplementary document (D13), so it carries the
// market's notice in bold when there is one.

export type PurchaseOrderEmailInput = {
  to: string;
  businessName: string;
  businessEmail: string | null;
  /** e.g. "Purchase order". */
  title: string;
  number: string;
  supplierName: string;
  /** Already formatted amount and dates. */
  total: string;
  orderedOn: string;
  expectedOn: string | null;
  /** What the sender typed for this email; may be blank. */
  message: string;
  notice: string | null;
  /** The app's public address, where the email's logo is loaded from. */
  appUrl?: string;
};

export function purchaseOrderEmail(input: PurchaseOrderEmailInput): EmailMessage {
  const C = brand.emailColors;
  const message = input.message.trim();
  const lines = [
    `${input.businessName} sent ${input.supplierName} ${input.title.toLowerCase()} ${input.number} for ${input.total}.`,
    `Ordered: ${input.orderedOn}`,
    ...(input.expectedOn ? [`Expected by: ${input.expectedOn}`] : []),
    ...(message ? [message] : []),
    `Please reply to this email to confirm the order.`,
  ];

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5">${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}${input.notice ? `<p><strong>${escapeHtml(input.notice)}</strong></p>` : ""}${brandSignoffHtml(
    input.appUrl ? originOf(input.appUrl) : null,
    "Sent with",
  )}</body></html>`;

  return {
    to: input.to,
    subject: `${input.title} ${input.number} from ${input.businessName}`,
    senderName: `${input.businessName} via ${brand.name}`,
    ...(input.businessEmail ? { replyTo: input.businessEmail } : {}),
    text: [...lines, input.notice].filter(Boolean).join("\n\n"),
    html,
  };
}
