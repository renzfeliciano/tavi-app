"use server";

import { revalidatePath } from "next/cache";
import { formatAddressLines } from "@/config/markets";
import { searchLineSources } from "@/modules/catalog";
import { getCustomer, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { deleteDraftQuote, saveQuoteDraft } from "@/modules/quotes";
import { normalizeSearch } from "@/shared/text/search";
import type { CustomerChoice, LineSourceChoice } from "./_lib/editor-types";

export type SaveDraftResponse =
  | { ok: true; id: string; savedAt: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

/** Autosave: creates the draft on the first save, then updates it. */
export async function saveQuoteDraftAction(id: string | null, draft: unknown): Promise<SaveDraftResponse> {
  const ctx = await requireOrgContext();
  const result = await saveQuoteDraft(ctx, id, draft, { locale: ctx.locale });
  // No revalidatePath: quote pages render per request anyway, and autosave
  // fires every few seconds, so a refresh per save would only cost renders.
  if (result.ok) return { ok: true, id: result.quote.id, savedAt: Date.now() };
  if ("errors" in result) return { ok: false, errors: result.errors };
  if ("notEditable" in result) {
    return { ok: false, error: "This quote was sent from somewhere else, so it can't be edited here. Reload to see it." };
  }
  return { ok: false, error: "This quote no longer exists." };
}

export async function deleteDraftQuoteAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deleteDraftQuote(ctx, id);
  revalidatePath("/quotes");
  if (result.ok) return { ok: true };
  return { ok: false, error: "notFound" in result ? "This quote no longer exists." : result.error };
}

/** Active customers for the quote's customer picker. */
export async function searchCustomersAction(query: string): Promise<CustomerChoice[]> {
  const ctx = await requireOrgContext();
  const { customers } = await listCustomers(ctx, { search: normalizeSearch(query) });
  return customers.slice(0, 8).map((c) => ({ id: c.id, displayName: c.displayName, detail: c.company ?? c.email ?? c.phone }));
}

/** A customer as the document shows them, plus their preferred currency. */
export async function customerForDocumentAction(id: string) {
  const ctx = await requireOrgContext();
  const customer = await getCustomer(ctx, id);
  if (!customer) return null;
  return {
    id: customer.id,
    currency: customer.currency,
    party: {
      name: customer.displayName,
      subtitle: customer.company,
      addressLines: formatAddressLines(customer, ctx.market),
      contactLines: [customer.email, customer.phone].filter((line): line is string => Boolean(line)),
      taxId: customer.taxId ? { label: ctx.market.taxId.label, value: customer.taxId } : null,
    },
  };
}

/** Products and services for the line-item picker. */
export async function searchLineSourcesAction(query: string): Promise<LineSourceChoice[]> {
  const ctx = await requireOrgContext();
  const { products, services } = await searchLineSources(ctx, normalizeSearch(query));
  return [...services, ...products].map((s) => ({
    key: `${s.kind}:${s.id}`,
    kind: s.kind,
    id: s.id,
    name: s.name,
    description: s.description,
    sku: s.sku,
    unitLabel: s.unitLabel,
    unitPriceMinor: s.unitPriceMinor,
    currency: s.currency,
    taxRateId: s.taxRateId,
  }));
}
