"use server";

import { redirect } from "next/navigation";
import { activateOrganization, requireSession } from "@/modules/identity";
import { acceptInvitation } from "@/modules/organizations";

export type AcceptInvitationActionResult = { ok: false; error: string };

/** Joins the business the invitation is for, switches to it and opens its dashboard. */
export async function acceptInvitationAction(token: unknown): Promise<AcceptInvitationActionResult> {
  const { user, session } = await requireSession();
  const result = await acceptInvitation(token, { id: user.id, email: user.email });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "wrong_email"
          ? "This invitation is for a different email address. Sign in with that address to accept it."
          : "This invitation can't be used any more. Ask for a new one.",
    };
  }
  await activateOrganization(session.id, result.organizationId);
  redirect("/dashboard");
}
