import { currencyOptions } from "@/config/currencies";
import { type CatalogItem, type CatalogItemKind, examplePrice, formatRate, listTaxRates } from "@/modules/catalog";
import type { OrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { formatAmountForInput } from "@/shared/money";
import type { CatalogFormValues } from "../actions";
import type { CatalogItemFormCopy } from "./catalog-item-form";

/**
 * The item form's wording and choices, from the business's market and
 * settings. `current` keeps an archived tax rate selectable on an item that
 * already uses it.
 */
export async function catalogFormCopy(ctx: OrgContext, current?: CatalogItem): Promise<CatalogItemFormCopy> {
  const [rates, profile] = await Promise.all([listTaxRates(ctx), getBusinessProfile(ctx)]);
  const usable = rates.filter((rate) => rate.archivedAt === null || rate.id === current?.taxRateId);
  return {
    units: ctx.market.units.options,
    pricePlaceholder: `e.g. ${examplePrice(ctx.currency, ctx.locale)}`,
    taxModeHint:
      profile.taxMode === "inclusive"
        ? "Your prices include tax (set in Business profile), so enter them the way you quote them."
        : "Tax is added on top of your prices (set in Business profile), so enter them before tax.",
    currencies: currencyOptions({ locale: ctx.locale, first: current?.currency ?? ctx.currency }),
    taxRates: usable.map((rate) => ({
      id: rate.id,
      label: `${rate.name} (${formatRate(rate.rateBps, ctx.locale)})${rate.archivedAt ? " · archived" : ""}`,
    })),
  };
}

/** Starting values for a new item: the business's currency, default tax and the market's usual unit. */
export async function newItemValues(ctx: OrgContext, kind: CatalogItemKind): Promise<CatalogFormValues> {
  const rates = await listTaxRates(ctx);
  return {
    name: "",
    description: "",
    sku: "",
    unitLabel: ctx.market.units[kind],
    unitPrice: "",
    currency: ctx.currency,
    taxRateId: rates.find((rate) => rate.isDefault)?.id ?? "",
  };
}

/** A saved item as form values, its price written the way the business types it. */
export function itemFormValues(item: CatalogItem, locale: string): CatalogFormValues {
  return {
    name: item.name,
    description: item.description ?? "",
    sku: item.sku ?? "",
    unitLabel: item.unitLabel,
    unitPrice: formatAmountForInput(item.unitPriceMinor, item.currency, locale),
    currency: item.currency,
    taxRateId: item.taxRateId ?? "",
  };
}
