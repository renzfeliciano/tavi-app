"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import { removeOrganizationLogo, uploadOrganizationLogo } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import { type BusinessProfileInput, businessProfileSchema, updateBusinessProfile } from "@/modules/organizations";

type ProfileField = keyof BusinessProfileInput;
export type ProfileFormValues = Record<ProfileField, string>;

export type BusinessProfileState = {
  values: ProfileFormValues;
  fieldErrors?: Partial<Record<ProfileField, string[]>>;
  error?: string;
  /** Set on success so the form can confirm it (each save gets a new value). */
  savedAt?: number;
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
};

export type LogoState = { error?: string; savedAt?: number };

const NOT_ALLOWED = "Only owners and admins can change business settings.";

export async function saveBusinessProfile(
  _previous: BusinessProfileState,
  formData: FormData,
): Promise<BusinessProfileState> {
  const ctx = await requireOrgContext();
  const fields = Object.keys(businessProfileSchema.shape) as ProfileField[];
  const values = Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ProfileFormValues;
  if (!can(ctx, "organization.manage")) return { values, error: NOT_ALLOWED, submission: Date.now() };

  const result = await updateBusinessProfile(ctx, values);
  if (!result.ok) return { values, fieldErrors: result.fieldErrors, submission: Date.now() };

  // The business name also shows in the app shell.
  revalidatePath("/", "layout");
  const now = Date.now();
  return { values, savedAt: now, submission: now };
}

export async function uploadLogo(_previous: LogoState, formData: FormData): Promise<LogoState> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { error: NOT_ALLOWED };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };

  const result = await uploadOrganizationLogo(ctx, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings/business");
  return { savedAt: Date.now() };
}

export async function removeLogo(): Promise<LogoState> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { error: NOT_ALLOWED };
  await removeOrganizationLogo(ctx);
  revalidatePath("/settings/business");
  return { savedAt: Date.now() };
}
