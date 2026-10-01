import { brand } from "@/config/brand";
import { escapeHtml, type EmailMessage } from "./email";

// The payment acknowledgement a customer can get by email when the business
// records their payment (§B.5). It's a supplementary document (PH: RR 7-2024
// Sec. 6 B.15), so it carries the notice in bold and the market's disclaimer.

export type PaymentAcknowledgementEmailInput = {
  to: string;
  businessName: string;
  businessEmail: string | null;
  /** e.g. "Payment acknowledgement". */
  receiptTitle: string;
  receiptNumber: string;
  /** e.g. "Billing statement INV-000001". */
  documentName: string;
  /** Already formatted amounts and date. */
  received: string;
  withheld: { label: string; amount: string } | null;
  paidOn: string;
  /** What's still owed, or null when paid in full. */
  balance: string | null;
  notice: string | null;
  disclaimer: string | null;
};

export function paymentAcknowledgementEmail(input: PaymentAcknowledgementEmailInput): EmailMessage {
  const C = brand.emailColors;
  const lines = [
    `${input.businessName} received your payment for ${input.documentName}.`,
    `Amount received: ${input.received}`,
    input.withheld ? `${input.withheld.label}: ${input.withheld.amount}` : null,
    `Date: ${input.paidOn}`,
    `${input.receiptTitle} no.: ${input.receiptNumber}`,
    input.balance ? `Balance remaining: ${input.balance}` : "Paid in full. Thank you!",
  ].filter((line): line is string => line !== null);
  const footer = [input.disclaimer].filter((line): line is string => Boolean(line));

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5">${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}${input.notice ? `<p><strong>${escapeHtml(input.notice)}</strong></p>` : ""}${footer
    .map((line) => `<p style="color:${C.muted};font-size:13px">${escapeHtml(line)}</p>`)
    .join("")}<p style="color:${C.muted};font-size:12px">Sent with ${escapeHtml(brand.name)}</p></body></html>`;

  return {
    to: input.to,
    subject: `Payment received: ${input.documentName}`,
    senderName: `${input.businessName} via ${brand.name}`,
    ...(input.businessEmail ? { replyTo: input.businessEmail } : {}),
    text: [...lines, input.notice, ...footer].filter(Boolean).join("\n\n"),
    html,
  };
}
