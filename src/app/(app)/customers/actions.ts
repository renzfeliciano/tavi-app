"use server";

import { revalidatePath } from "next/cache";
import {
  archiveCustomer,
  CUSTOMER_FIELDS,
  type CustomerInput,
  createCustomer,
  restoreCustomer,
  updateCustomer,
} from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";

export type CustomerFormValues = Record<keyof CustomerInput, string>;

export type CustomerFormState = {
  values?: CustomerFormValues;
  fieldErrors?: Partial<Record<keyof CustomerInput, string[]>>;
  error?: string;
  /** Set on success: the saved customer. */
  saved?: { id: string; displayName: string; at: number };
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
};

export type CustomerCommandResult = { ok: true } | { ok: false; error: string };

const GONE = "That customer no longer exists. Refresh the page.";

/** Adds a customer, or updates one when the form carries an `id`. */
export async function saveCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await requireOrgContext();
  const values = Object.fromEntries(
    CUSTOMER_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as CustomerFormValues;
  const id = String(formData.get("id") ?? "");

  const result = id ? await updateCustomer(ctx, id, values) : await createCustomer(ctx, values);
  const submission = Date.now();
  if (!result.ok) {
    return "notFound" in result
      ? { values, error: GONE, submission }
      : { values, fieldErrors: result.fieldErrors, submission };
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.customer.id}`);
  return {
    values,
    saved: { id: result.customer.id, displayName: result.customer.displayName, at: submission },
    submission,
  };
}

export async function archiveCustomerAction(id: string): Promise<CustomerCommandResult> {
  const ctx = await requireOrgContext();
  const result = await archiveCustomer(ctx, id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}

export async function restoreCustomerAction(id: string): Promise<CustomerCommandResult> {
  const ctx = await requireOrgContext();
  const result = await restoreCustomer(ctx, id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}
