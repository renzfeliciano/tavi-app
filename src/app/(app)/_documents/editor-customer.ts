import { formatAddressLines, type MarketProfile } from "@/config/markets";
import { type Customer, getCustomer } from "@/modules/customers";
import type { OrgContext } from "@/modules/identity";
import type { EditorCustomer } from "./editor-types";

/** A customer as a document shows them, plus their preferred currency. */
export function toEditorCustomer(customer: Customer, market: MarketProfile): EditorCustomer {
  return {
    id: customer.id,
    currency: customer.currency,
    email: customer.email,
    party: {
      name: customer.displayName,
      subtitle: customer.company,
      addressLines: formatAddressLines(customer, market),
      contactLines: [customer.email, customer.phone].filter((line): line is string => Boolean(line)),
      taxId: customer.taxId ? { label: market.taxId.label, value: customer.taxId } : null,
    },
  };
}

/**
 * The customer a new quotation or billing statement starts with, from `?customer=` (the customer's own page
 * links there). Anything else, an archived customer or another business's, starts it without one.
 */
export async function customerToStartWith(
  ctx: OrgContext,
  param: string | string[] | undefined,
): Promise<EditorCustomer | null> {
  if (typeof param !== "string") return null;
  const customer = await getCustomer(ctx, param);
  return customer && customer.archivedAt === null ? toEditorCustomer(customer, ctx.market) : null;
}
