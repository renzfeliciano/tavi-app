"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import { DOCUMENT_KINDS, type DocumentKind, updateDocumentNumbering } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";

export type NumberingFormState = {
  values?: { prefix: string; padding: string };
  fieldErrors?: Partial<Record<"prefix" | "padding", string[]>>;
  error?: string;
  savedAt?: number;
};

export async function saveNumbering(
  _previous: NumberingFormState,
  formData: FormData,
): Promise<NumberingFormState> {
  const ctx = await requireOrgContext();
  const values = { prefix: String(formData.get("prefix") ?? ""), padding: String(formData.get("padding") ?? "") };
  if (!can(ctx, "organization.manage")) {
    return { values, error: "Only owners and admins can change document numbers." };
  }
  const kind = String(formData.get("kind"));
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) return { values, error: "Unknown document type." };

  const result = await updateDocumentNumbering(ctx, kind as DocumentKind, values);
  if (!result.ok) return { values, fieldErrors: result.fieldErrors };
  revalidatePath("/settings/numbering");
  return { savedAt: Date.now() };
}
