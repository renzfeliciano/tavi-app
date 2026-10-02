"use server";

import { redirect } from "next/navigation";
import { confirmCurrentPassword, forgetSessionCookies, requireSession } from "@/modules/identity";
import { closeAccount } from "@/modules/privacy";

export type CloseAccountActionResult = { ok: false; field?: "password"; error: string };

/** Checks the password, closes the account (D16), then lands on /account-closed. */
export async function closeAccountAction(password: unknown): Promise<CloseAccountActionResult> {
  const { user } = await requireSession();
  const check = await confirmCurrentPassword(password);
  if (check === "rate_limited") {
    return { ok: false, error: "Too many attempts. Wait 15 minutes, then try again." };
  }
  if (check === "wrong") {
    return { ok: false, field: "password", error: "That password isn't right. Try again." };
  }

  const result = await closeAccount(user.id);
  if (!result.ok && result.error === "shared_business") {
    return {
      ok: false,
      error: "Other people still use a business you own. Make one of them the owner in Settings, Team, then close your account.",
    };
  }
  // Closed now, or already closed by another tab: either way the session is gone.
  await forgetSessionCookies();
  redirect("/account-closed");
}
