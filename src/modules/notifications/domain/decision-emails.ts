import { brand } from "@/config/brand";
import { escapeHtml, type EmailMessage } from "./email";

// The instant email to the business when a customer approves or declines a
// quote from its link (§G.4, §I: it also mitigates a forwarded link).

export type QuoteDecisionEmailInput = {
  to: string;
  customerName: string;
  /** e.g. "Quotation". */
  title: string;
  number: string;
  /** Already formatted, e.g. "₱3,450.00". */
  total: string;
  decision: { kind: "approve"; name: string } | { kind: "reject"; reason: string | null };
  /** The quote in the app. */
  url: string;
};

export function quoteDecisionEmail(input: QuoteDecisionEmailInput): EmailMessage {
  const heading = `${input.title} ${input.number}`;
  const verb = input.decision.kind === "approve" ? "approved" : "declined";
  const subject = `${input.customerName} ${verb} ${heading}`;
  const detail =
    input.decision.kind === "approve"
      ? `Approved by ${input.decision.name}`
      : input.decision.reason
        ? `Reason: ${input.decision.reason}`
        : null;
  const url = escapeHtml(input.url);
  const C = brand.emailColors;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5"><p><strong>${escapeHtml(
    subject,
  )}</strong> (${escapeHtml(input.total)}).</p>${
    detail ? `<p style="white-space:pre-wrap">${escapeHtml(detail)}</p>` : ""
  }<p><a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:${C.accent};color:${C.onAccent};text-decoration:none">Open the quote</a></p><p style="color:${C.muted};font-size:12px">${escapeHtml(
    brand.name,
  )}</p></body></html>`;

  return {
    to: input.to,
    subject,
    text: [`${subject} (${input.total}).`, detail, `Open the quote: ${input.url}`].filter(Boolean).join("\n\n"),
    html,
  };
}
