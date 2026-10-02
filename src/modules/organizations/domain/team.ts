import { z } from "zod";
import type { Role } from "@/modules/authz";
import { describeDuration } from "@/shared/format/duration";
import { tooLong } from "@/shared/validation/messages";

// Teams (proposal Phase 2.1, D17): owners and admins invite people by email
// as admins or members; one owner per business, changed only by transferring
// ownership.

export const TEAM_LIMITS = {
  /** People per business during the free beta, pending invitations included. */
  maxPeople: 10,
  /** How long an invitation link works. */
  invitationSeconds: 7 * 24 * 60 * 60,
  email: 254,
} as const;

/** Roles someone can be invited as or changed to (ownership is transferred, never assigned). */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  admin: "Everything except closing the business or transferring it: settings, team, payments and voids.",
  member: "Customers, products, quotes and bills. Can't record payments, void, or change settings.",
};

export const invitationInputSchema = z.object({
  email: z
    .string({ error: "Enter their email address." })
    .trim()
    .toLowerCase()
    .min(1, { error: "Enter their email address." })
    .max(TEAM_LIMITS.email, { error: tooLong(TEAM_LIMITS.email) })
    .pipe(z.email({ error: "Enter a valid email address." })),
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choose a role." }),
});
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const teamFullMessage = () =>
  `A business can have up to ${TEAM_LIMITS.maxPeople} people during the beta, counting open invitations. Cancel an invitation or remove someone first.`;

export const invitationLifetime = () => describeDuration(TEAM_LIMITS.invitationSeconds);

/** An invitation's state on the day it's opened. */
export type InvitationState = "open" | "expired" | "accepted" | "cancelled";

export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date,
): InvitationState {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "cancelled";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return "open";
}

/** Emails are compared as Better Auth stores them: trimmed and lowercased. */
export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Whether `actor` may change or remove `target` in the team. The owner is
 * never changed this way (transfer ownership instead), and nobody manages
 * themselves (leave instead).
 */
export function canManageMember(actor: { userId: string }, target: { userId: string; role: Role }): boolean {
  return target.role !== "owner" && target.userId !== actor.userId;
}

/** Invitation tokens are 32 random bytes, base64url. */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Where sign-up and sign-in go next when they were opened from an invitation
 * (`?invite=<token>`): back to it. Anything else is ignored, so the parameter
 * can't send people elsewhere.
 */
export function invitationReturnPath(value: unknown): `/invite/${string}` | null {
  return typeof value === "string" && INVITATION_TOKEN_PATTERN.test(value) ? `/invite/${value}` : null;
}
