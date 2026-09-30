"use server";

import { formatAddressLines } from "@/config/markets";
import { searchLineSources } from "@/modules/catalog";
import { getCustomer, listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { normalizeSearch } from "@/shared/text/search";
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
  if (!customer) return null;
  return {
    id: customer.id,
    currency: customer.currency,
    email: customer.email,
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
