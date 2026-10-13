import { formatAmountForInput } from "@/shared/money";

type CatalogSource = { name: string; unitPriceMinor: number | null; currency: string };

/**
 * The price a line starts with when it is added from Products & Services, and
 * what to tell the owner if they have to fill it in. A price is only copied when
 * the item is priced in the document's own currency; an item with no price yet
 * leaves the line blank to be priced there.
 */
export function catalogLinePrice(
  source: CatalogSource,
  documentCurrency: string,
  locale: string,
): { unitPrice: string; notice: string | null } {
  if (source.unitPriceMinor === null) {
    return { unitPrice: "", notice: `${source.name} has no price yet. Enter it on the line.` };
  }
  if (source.currency !== documentCurrency) {
    return {
      unitPrice: "",
      notice: `${source.name} is priced in ${source.currency}. Enter its ${documentCurrency} price.`,
    };
  }
  return { unitPrice: formatAmountForInput(source.unitPriceMinor, source.currency, locale), notice: null };
}
