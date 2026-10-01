"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { saveInvoiceRegistration, turnOffInvoiceRegistration } from "@/modules/invoices";

export type RegistrationValues = { number: string; issuedOn: string; seriesStart: string; seriesEnd: string; title: string };

export type RegistrationFormState = {
  values?: RegistrationValues;
  errors?: Record<string, string>;
  error?: string;
  savedAt?: number;
};

const NOT_ALLOWED = "Only owners and admins can change invoice registration.";

export async function saveRegistrationAction(
  _previous: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const ctx = await requireOrgContext();
  const field = (name: keyof RegistrationValues) => String(formData.get(name) ?? "");
  const values: RegistrationValues = {
    number: field("number"),
    issuedOn: field("issuedOn"),
    seriesStart: field("seriesStart"),
    seriesEnd: field("seriesEnd"),
    title: field("title"),
  };
  if (!can(ctx, "organization.manage")) return { values, error: NOT_ALLOWED };
  const result = await saveInvoiceRegistration(ctx, values, { market: ctx.market });
  if (!result.ok) return { values, errors: result.errors };
  revalidatePath("/settings/invoicing");
  revalidatePath("/invoices", "layout");
  return { values, savedAt: Date.now() };
}

export async function turnOffRegistrationAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { ok: false, error: NOT_ALLOWED };
  const result = await turnOffInvoiceRegistration(ctx);
  revalidatePath("/settings/invoicing");
  revalidatePath("/invoices", "layout");
  return result.ok ? { ok: true } : { ok: false, error: "Invoice mode is already off." };
}
