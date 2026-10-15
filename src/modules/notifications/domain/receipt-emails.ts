import { brand } from "@/config/brand";
import { brandSignoffHtml, escapeHtml, type EmailMessage, originOf } from "./email";

// The copy of a receipt a payer can get by email (docs/superpowers/specs/2026-10-15-receipts-design.md). It is a
// supplementary document (PH: RR 7-2024 Sec. 6 B.15), so it carries the notice in bold and the market's disclaimer.

export type ReceiptEmailInput = {
  to: string;
  businessName: string;
  businessEmail: string | null;
  /** e.g. "Collection receipt". */
  receiptTitle: string;
  receiptNumber: string;
  payerName: string;
  purpose: string;
  /** Already formatted amount and date. */
  received: string;
  receivedOn: string;
  /** The proof of payment as the business typed it, already labelled. */
  details: { label: string; value: string }[];
  notice: string | null;
  disclaimer: string | null;
  /** The app's public address, where the email's logo is loaded from. */
  appUrl?: string;
};

export function receiptEmail(input: ReceiptEmailInput): EmailMessage {
  const C = brand.emailColors;
  const lines = [
    `${input.businessName} received ${input.received} from ${input.payerName} for ${input.purpose}.`,
    `Date: ${input.receivedOn}`,
    ...input.details.map((row) => `${row.label}: ${row.value}`),
    `${input.receiptTitle} no.: ${input.receiptNumber}`,
  ];
  const footer = [input.disclaimer].filter((line): line is string => Boolean(line));

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5">${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}${input.notice ? `<p><strong>${escapeHtml(input.notice)}</strong></p>` : ""}${footer
    .map((line) => `<p style="color:${C.muted};font-size:13px">${escapeHtml(line)}</p>`)
    .join("")}${brandSignoffHtml(input.appUrl ? originOf(input.appUrl) : null, "Sent with")}</body></html>`;

  return {
    to: input.to,
    subject: `${input.receiptTitle} ${input.receiptNumber} from ${input.businessName}`,
    senderName: `${input.businessName} via ${brand.name}`,
    ...(input.businessEmail ? { replyTo: input.businessEmail } : {}),
    text: [...lines, input.notice, ...footer].filter(Boolean).join("\n\n"),
    html,
  };
}
