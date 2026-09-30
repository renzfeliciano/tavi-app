import { brand } from "@/config/brand";
import { escapeHtml, type EmailMessage } from "./email";

// Account emails. Plain and short; branded templates (React Email) arrive with
// the outbox in Phase 0.5.

type AuthEmailInput = { to: string; name: string; url: string };
type ExpiringLinkInput = AuthEmailInput & { /** e.g. "30 minutes", from the auth policy. */ expiresIn: string };

function layout(paragraphs: string[], action: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join("");
  const url = escapeHtml(action.url);
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${brand.emailColors.ink};line-height:1.5">${body}<p><a href="${url}">${escapeHtml(action.label)}</a></p><p style="color:${brand.emailColors.muted};font-size:13px">If the button doesn't work, paste this link into your browser:<br>${url}</p></body></html>`;
}

export function verifyEmailEmail({ to, name, url }: AuthEmailInput): EmailMessage {
  return {
    to,
    subject: `Verify your email for ${brand.name}`,
    text: [
      `Hi ${name},`,
      `Confirm your email address to start sending quotes and invoices from ${brand.name}:`,
      url,
      `If you didn't create a ${brand.name} account, you can ignore this email.`,
    ].join("\n\n"),
    html: layout(
      [
        `Hi ${escapeHtml(name)},`,
        `Confirm your email address to start sending quotes and invoices from ${brand.name}.`,
      ],
      { label: "Verify email", url },
    ),
  };
}

export function passwordResetEmail({ to, name, url, expiresIn }: ExpiringLinkInput): EmailMessage {
  return {
    to,
    subject: `Reset your ${brand.name} password`,
    text: [
      `Hi ${name},`,
      `Use this link to choose a new password. It works once and expires in ${expiresIn}:`,
      url,
      "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
    ].join("\n\n"),
    html: layout(
      [
        `Hi ${escapeHtml(name)},`,
        `Use this link to choose a new password. It works once and expires in ${expiresIn}.`,
        "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
      ],
      { label: "Choose a new password", url },
    ),
  };
}
