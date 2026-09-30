"use server";

import { revalidatePath } from "next/cache";
import {
  archiveCatalogItem,
  CATALOG_ITEM_FIELDS,
  type CatalogItemKind,
  createCatalogItem,
  restoreCatalogItem,
  updateCatalogItem,
} from "@/modules/catalog";
import { type OrgContext, requireOrgContext } from "@/modules/identity";

export type CatalogFormValues = Record<string, string>;

export type CatalogFormState = {
  values?: CatalogFormValues;
  fieldErrors?: Partial<Record<string, string[]>>;
  error?: string;
  saved?: { id: string; name: string; at: number };
  /** New on every response, so the form re-mounts its fields with the returned values. */
  submission?: number;
};

export type CatalogCommandResult = { ok: true } | { ok: false; error: string };

const GONE = "That item no longer exists. Refresh the page.";

const inputOptions = (ctx: OrgContext) => ({ locale: ctx.locale, units: ctx.market.units });

function kindOf(value: FormDataEntryValue | null): CatalogItemKind | null {
  return value === "product" || value === "service" ? value : null;
}

/** Adds a product or service, or updates one when the form carries an `id`. */
export async function saveCatalogItem(
  _previous: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const ctx = await requireOrgContext();
  const kind = kindOf(formData.get("kind"));
  if (!kind) return { error: GONE };
  const values = Object.fromEntries(
    CATALOG_ITEM_FIELDS[kind].map((field) => [field, String(formData.get(field) ?? "")]),
  );
  const id = String(formData.get("id") ?? "");

  const result = id
    ? await updateCatalogItem(ctx, kind, id, values, inputOptions(ctx))
    : await createCatalogItem(ctx, kind, values, inputOptions(ctx));
  const submission = Date.now();
  if (!result.ok) {
    return "notFound" in result
      ? { values, error: GONE, submission }
      : { values, fieldErrors: result.fieldErrors, submission };
  }
  revalidatePath("/catalog");
  return { values, saved: { id: result.item.id, name: result.item.name, at: submission }, submission };
}

export async function archiveCatalogItemAction(kind: CatalogItemKind, id: string): Promise<CatalogCommandResult> {
  const ctx = await requireOrgContext();
  const result = await archiveCatalogItem(ctx, kind, id);
  revalidatePath("/catalog", "layout");
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}

export async function restoreCatalogItemAction(kind: CatalogItemKind, id: string): Promise<CatalogCommandResult> {
  const ctx = await requireOrgContext();
  const result = await restoreCatalogItem(ctx, kind, id);
  revalidatePath("/catalog", "layout");
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}
