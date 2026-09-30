import { currencyExponent, formatMoney } from "@/shared/money";
import { formatRate } from "./tax-rate";

type Example = { currency: string; locale: string; tax: { name: string; rateBps: number } | null };

/**
 * One-line explanations of "prices include tax" and "tax is added on top",
 * worked through a round price in the business's currency and its market's
 * suggested tax, so the example always matches what the business will see.
 */
export function taxModeExamples({ currency, locale, tax }: Example) {
  if (!tax) {
    return {
      inclusive: "The prices you enter already include tax.",
      exclusive: "Tax is added to the prices you enter.",
    };
  }
  const base = 1000 * 10 ** currencyExponent(currency);
  const taxAmount = Math.round((base * tax.rateBps) / 10_000);
  const money = (minor: number) => formatMoney(minor, currency, { locale });
  return {
    inclusive: `${money(base + taxAmount)} means ${money(base)} + ${money(taxAmount)} ${tax.name}.`,
    exclusive: `${money(base)} becomes ${money(base + taxAmount)} with ${formatRate(tax.rateBps, locale)} ${tax.name}.`,
  };
}
