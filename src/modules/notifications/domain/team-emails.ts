import { brand } from "@/config/brand";
import { escapeHtml, type EmailMessage } from "./email";

// The invitation to join a business in Tavi (Phase 2.1, D17). From Tavi on
// the business's behalf; the link is the point.

export type TeamInvitationEmailInput = {
  to: string;
  businessName: string;
  inviterName: string;
  /** e.g. "Admin". */
  roleLabel: string;
  url: string;
  /** e.g. "7 days". */
  expiresIn: string;
};

export function teamInvitationEmail(input: TeamInvitationEmailInput): EmailMessage {
  const subject = `${input.inviterName} invited you to ${input.businessName} on ${brand.name}`;
  const lead = `${input.inviterName} invited you to join ${input.businessName} on ${brand.name} as ${articleFor(input.roleLabel)} ${input.roleLabel.toLowerCase()}.`;
  const expiry = `The invitation works for ${input.expiresIn}. If you weren't expecting it, you can ignore this email.`;
  const url = escapeHtml(input.url);
  const C = brand.emailColors;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:${C.ink};line-height:1.5"><p>${escapeHtml(
    lead,
  )}</p><p><a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:${C.accent};color:${C.onAccent};text-decoration:none">Accept the invitation</a></p><p style="color:${C.muted};font-size:13px">${escapeHtml(
    expiry,
  )}</p><p style="color:${C.muted};font-size:13px">If the button doesn't work, paste this link into your browser:<br>${url}</p><p style="color:${C.muted};font-size:12px">${escapeHtml(
    brand.name,
  )}</p></body></html>`;

  return {
    to: input.to,
    subject,
    text: [lead, `Accept the invitation: ${input.url}`, expiry].join("\n\n"),
    html,
  };
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
