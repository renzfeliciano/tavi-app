"use server";

import { redirect } from "next/navigation";
import { activateOrganization, requireSession } from "@/modules/identity";
import { createOrganizationForUser } from "@/modules/organizations";

export type CreateBusinessState = {
  fieldErrors?: { name?: string[]; currency?: string[]; country?: string[] };
  values?: { name: string; currency: string; country: string };
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
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
    country: String(formData.get("country") ?? ""),
  };

  const result = await createOrganizationForUser(user.id, values);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values, submission: Date.now() };

  await activateOrganization(session.id, result.organization.id);
  redirect("/dashboard");
}
