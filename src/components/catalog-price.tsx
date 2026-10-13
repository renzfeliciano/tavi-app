import { MoneyAmount } from "@/components/money-amount";

type CatalogPriceProps = {
  /** Integer minor units, or null when the price isn't known yet. */
  priceMinor: number | null;
  /** ISO 4217 code of the item's own currency. */
  currency: string;
  unitLabel: string;
  /** The business's locale (`ctx.locale`). */
  locale?: string;
};

/**
 * A product or service's price and what it is per, for lists and the line-item
 * picker. An item whose price isn't known yet says so rather than showing an
 * amount: that is not the same as a free item, which shows 0.
 */
export function CatalogPrice({ priceMinor, currency, unitLabel, locale }: CatalogPriceProps) {
  return (
    <>
      {priceMinor === null ? (
        <span className="text-muted-foreground">No price yet</span>
      ) : (
        <MoneyAmount amountMinor={priceMinor} currency={currency} locale={locale} />
      )}
      <span className="block text-muted-foreground">per {unitLabel}</span>
    </>
  );
}
