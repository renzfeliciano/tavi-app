import type { MarketProfile } from "@/config/markets";
import type { TrashItem } from "@/modules/trash";

type Named = Pick<TrashItem, "kind" | "label" | "customerName">;

/** What a deleted record is, in the market's own words: "Quotation draft", "Quotation QUO-000012", "BIR Form 2307 · Acme, Q3 2026". */
export function trashItemKindName(item: Named, market: MarketProfile): string {
  const { quote, invoice, receipt } = market.documents;
  switch (item.kind) {
    case "invoice":
      return `${invoice.singular} draft`;
    case "quote":
      return `${quote.singular} draft`;
    case "sent_quote":
      return item.label ? `${quote.singular} ${item.label}` : quote.singular;
    case "payment":
      return item.label ? `${receipt.singular} ${item.label}` : receipt.singular;
    case "certificate": {
      const name = market.taxWithheld?.certificate.name ?? "Withholding certificate";
      return item.label ? `${name} · ${item.label}` : name;
    }
  }
}

/** The same with who it was for: "Quotation QUO-000012 for Juan Dela Cruz". */
export function trashItemName(item: Named, market: MarketProfile): string {
  const name = trashItemKindName(item, market);
  return item.customerName ? `${name} for ${item.customerName}` : name;
}
