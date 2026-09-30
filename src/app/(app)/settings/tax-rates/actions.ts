"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import {
  archiveTaxRate,
  createTaxRate,
  restoreTaxRate,
  setDefaultTaxRate,
  type TaxRateActionResult,
  updateTaxRate,
} from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";

export type TaxRateFormState = {
  values?: { name: string; rate: string };
  fieldErrors?: Partial<Record<"name" | "rate", string[]>>;
  error?: string;
  savedAt?: number;
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
};

export type TaxRateCommandResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "Only owners and admins can change tax rates.";
const GONE = "That tax rate no longer exists. Refresh the page.";

/** Creates a rate, or updates one when the form carries an `id`. */
export async function saveTaxRate(
  _previous: TaxRateFormState,
  formData: FormData,
): Promise<TaxRateFormState> {
  const ctx = await requireOrgContext();
  const values = { name: String(formData.get("name") ?? ""), rate: String(formData.get("rate") ?? "") };
  if (!can(ctx, "organization.manage")) return { values, error: NOT_ALLOWED, submission: Date.now() };

  const id = String(formData.get("id") ?? "");
  const result = id
    ? await updateTaxRate(ctx, id, values, { locale: ctx.locale })
    : await createTaxRate(ctx, { ...values, makeDefault: formData.get("makeDefault") === "on" }, { locale: ctx.locale });
  if (!result.ok) {
    return "notFound" in result
      ? { values, error: GONE, submission: Date.now() }
      : { values, fieldErrors: result.fieldErrors, submission: Date.now() };
  }
  revalidatePath("/settings/tax-rates");
  return { values: { ...values, name: result.taxRate.name }, savedAt: Date.now() };
}

async function run(
  command: (ctx: Awaited<ReturnType<typeof requireOrgContext>>) => Promise<TaxRateActionResult>,
): Promise<TaxRateCommandResult> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return { ok: false, error: NOT_ALLOWED };
  const result = await command(ctx);
  revalidatePath("/settings/tax-rates");
  if (result.ok) return { ok: true };
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

export async function makeDefaultTaxRate(id: string | null): Promise<TaxRateCommandResult> {
  return run((ctx) => setDefaultTaxRate(ctx, id));
}

export async function archiveTaxRateAction(id: string): Promise<TaxRateCommandResult> {
  return run((ctx) => archiveTaxRate(ctx, id));
}

export async function restoreTaxRateAction(id: string): Promise<TaxRateCommandResult> {
  return run((ctx) => restoreTaxRate(ctx, id));
}
