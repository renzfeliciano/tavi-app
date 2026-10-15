"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import {
  archiveSupplier,
  createSupplier,
  restoreSupplier,
  SUPPLIER_FIELDS,
  type SupplierInput,
  updateSupplier,
} from "@/modules/purchasing";

export type SupplierFormValues = Record<keyof SupplierInput, string>;

export type SupplierFormState = {
  values?: SupplierFormValues;
  fieldErrors?: Partial<Record<keyof SupplierInput, string[]>>;
  error?: string;
  /** Set on success: the saved supplier. */
  saved?: { id: string; displayName: string; at: number };
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
};

export type SupplierCommandResult = { ok: true } | { ok: false; error: string };

const GONE = "That supplier no longer exists. Refresh the page.";

/** Adds a supplier, or updates one when the form carries an `id`. */
export async function saveSupplier(_previous: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  const ctx = await requireOrgContext();
  const values = Object.fromEntries(SUPPLIER_FIELDS.map((field) => [field, String(formData.get(field) ?? "")])) as SupplierFormValues;
  const id = String(formData.get("id") ?? "");

  const result = id ? await updateSupplier(ctx, id, values) : await createSupplier(ctx, values);
  const submission = Date.now();
  if (!result.ok) {
    return "notFound" in result ? { values, error: GONE, submission } : { values, fieldErrors: result.fieldErrors, submission };
  }
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.supplier.id}`);
  return { values, saved: { id: result.supplier.id, displayName: result.supplier.displayName, at: submission }, submission };
}

export async function archiveSupplierAction(id: string): Promise<SupplierCommandResult> {
  const ctx = await requireOrgContext();
  const result = await archiveSupplier(ctx, id);
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}

export async function restoreSupplierAction(id: string): Promise<SupplierCommandResult> {
  const ctx = await requireOrgContext();
  const result = await restoreSupplier(ctx, id);
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}
