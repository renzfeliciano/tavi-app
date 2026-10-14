"use server";

import { searchLineSources } from "@/modules/catalog";
import { getCustomer, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { normalizeSearch } from "@/shared/text/search";
import { toEditorCustomer } from "./editor-customer";
import type { CustomerChoice, EditorCustomer, LineSourceChoice } from "./editor-types";

// Lookups shared by the quote and invoice editors.

/** Active customers for the document's customer picker. */
export async function searchCustomersAction(query: string): Promise<CustomerChoice[]> {
  const ctx = await requireOrgContext();
  const { customers } = await listCustomers(ctx, { search: normalizeSearch(query) });
  return customers.slice(0, 8).map((c) => ({ id: c.id, displayName: c.displayName, detail: c.company ?? c.email ?? c.phone }));
}

/** A customer as the document shows them, plus their preferred currency. */
export async function customerForDocumentAction(id: string): Promise<EditorCustomer | null> {
  const ctx = await requireOrgContext();
  const customer = await getCustomer(ctx, id);
  return customer ? toEditorCustomer(customer, ctx.market) : null;
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
