"use server";

import { redirect } from "next/navigation";
import { activateOrganization, requireSession } from "@/modules/identity";
import { createOrganizationForUser } from "@/modules/organizations";

export type CreateBusinessState = {
  fieldErrors?: { name?: string[]; currency?: string[] };
  values?: { name: string; currency: string };
};

/** Onboarding: create the user's business and make it their active one. */
export async function createBusiness(
  _previous: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const { user, session } = await requireSession();
  const values = {
    name: String(formData.get("name") ?? ""),
    currency: String(formData.get("currency") ?? ""),
  };

  const result = await createOrganizationForUser(user.id, values);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values };

  await activateOrganization(session.id, result.organization.id);
  redirect("/dashboard");
}
