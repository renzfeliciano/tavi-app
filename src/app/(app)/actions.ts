"use server";

import { redirect } from "next/navigation";
import { activateOrganization, requireSession, signOutCurrentSession } from "@/modules/identity";
import { listMyBusinesses } from "@/modules/organizations";

export async function signOut(): Promise<void> {
  await signOutCurrentSession();
  redirect("/sign-in");
}

/** Switches this session to another of the person's businesses (D17). Never trusts the ID: it must be one of theirs. */
export async function switchBusiness(organizationId: string): Promise<void> {
  const { user, session } = await requireSession();
  const mine = await listMyBusinesses(user.id);
  if (mine.some((b) => b.organizationId === organizationId)) {
    await activateOrganization(session.id, organizationId);
  }
  redirect("/dashboard");
}
