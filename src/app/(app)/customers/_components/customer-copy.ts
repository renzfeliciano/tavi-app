import { currencyOptions } from "@/config/currencies";
import { documentWording } from "@/config/markets";
import type { OrgContext } from "@/modules/identity";
import type { CustomerFormCopy } from "./customer-form";

/** The customer form's wording and choices, from the business's market and settings. */
export function customerFormCopy(ctx: OrgContext): CustomerFormCopy {
  return {
    taxIdLabel: ctx.market.taxId.label,
    documents: documentWording(ctx.market).quotesAndInvoices,
    address: ctx.market.address,
    businessCurrency: ctx.currency,
    currencies: currencyOptions({ locale: ctx.locale, first: ctx.currency }),
  };
}
