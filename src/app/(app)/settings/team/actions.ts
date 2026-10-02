"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/modules/identity";
import {
  changeMemberRole,
  type InviteResult,
  inviteMember,
  leaveBusiness,
  type MemberChangeResult,
  removeMember,
  revokeInvitation,
  transferOwnership,
} from "@/modules/organizations";
import { env } from "@/shared/env";

const PAGE = "/settings/team";

export async function inviteMemberAction(input: { email: unknown; role: unknown }): Promise<InviteResult> {
  const ctx = await requireOrgContext();
  const result = await inviteMember(ctx, input, { appUrl: env.APP_URL });
  if (result.ok) revalidatePath(PAGE);
  return result;
}

export async function revokeInvitationAction(invitationId: string): Promise<{ ok: boolean; email?: string }> {
  const ctx = await requireOrgContext();
  const result = await revokeInvitation(ctx, invitationId);
  revalidatePath(PAGE);
  return result;
}

export async function changeRoleAction(userId: string, role: unknown): Promise<MemberChangeResult> {
  const ctx = await requireOrgContext();
  const result = await changeMemberRole(ctx, userId, role);
  revalidatePath(PAGE);
  return result;
}

export async function removeMemberAction(userId: string): Promise<MemberChangeResult> {
  const ctx = await requireOrgContext();
  const result = await removeMember(ctx, userId);
  revalidatePath(PAGE);
  return result;
}

export async function transferOwnershipAction(userId: string): Promise<MemberChangeResult> {
  const ctx = await requireOrgContext();
  const result = await transferOwnership(ctx, userId);
  revalidatePath(PAGE);
  return result;
}

/** Leaves the current business; the dashboard then opens the next one (or onboarding). */
export async function leaveBusinessAction(): Promise<{ ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await leaveBusiness(ctx);
  if (!result.ok) return result;
  redirect("/dashboard");
}
