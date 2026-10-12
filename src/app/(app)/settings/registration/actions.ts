"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import {
  DOCUMENT_MESSAGES,
  removeRegistrationDocument,
  uploadRegistrationDocument,
} from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import {
  REGISTRATION_FIELDS,
  type RegistrationField,
  updateBusinessRegistration,
} from "@/modules/organizations";

export type RegistrationValues = Record<RegistrationField, string>;

export type RegistrationFormState = {
  values?: RegistrationValues;
  errors?: Partial<Record<RegistrationField | "form", string>>;
  savedAt?: number;
};

export type DocumentState = { error?: string; savedAt?: number };

const NOT_ALLOWED = "Only owners and admins can change registration details.";

export async function saveRegistrationAction(
  _previous: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const ctx = await requireOrgContext();
  const values = Object.fromEntries(
    REGISTRATION_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as RegistrationValues;
  if (!can(ctx, "organization.manage")) return { values, errors: { form: NOT_ALLOWED } };

  const result = await updateBusinessRegistration(ctx, values);
  if (!result.ok) return { values, errors: result.errors };
  revalidatePath("/settings/registration");
  return { values, savedAt: Date.now() };
}

export async function uploadDocumentAction(_previous: DocumentState, formData: FormData): Promise<DocumentState> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { error: NOT_ALLOWED };
  const config = ctx.market.registration;
  if (!config) return { error: "Documents aren't available in your country yet." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: DOCUMENT_MESSAGES.empty };

  const result = await uploadRegistrationDocument(
    ctx,
    { bytes: new Uint8Array(await file.arrayBuffer()), kind: String(formData.get("kind") ?? ""), fileName: file.name },
    config.documentKinds.map((k) => k.code),
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings/registration");
  return { savedAt: Date.now() };
}

export async function removeDocumentAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { ok: false, error: NOT_ALLOWED };
  const removed = await removeRegistrationDocument(ctx, id);
  revalidatePath("/settings/registration");
  return removed ? { ok: true } : { ok: false, error: "That document is already gone." };
}
