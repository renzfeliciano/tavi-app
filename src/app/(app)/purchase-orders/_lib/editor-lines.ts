import type { EditorLine } from "../../_documents/line-items-editor";
import { formatQuantity } from "@/modules/documents/client";
import type { PurchaseOrderLine } from "@/modules/purchasing";
import { formatAmountForInput } from "@/shared/money";
import { formatRateForInput } from "@/shared/numbers/percent";

/** A saved draft's lines back into what the line editor shows: numbers as a person types them. */
export function toEditorLines(lines: readonly PurchaseOrderLine[], currency: string, locale: string): EditorLine[] {
  return lines.map((line) => ({
    key: `line-${line.position}`,
    description: line.description,
    quantity: formatQuantity(line.quantity, locale),
    unitLabel: line.unitLabel,
    unitPrice: formatAmountForInput(line.unitPriceMinor, currency, locale),
    discountKind: line.discountKind ?? "none",
    discountValue:
      line.discountKind === "percent" && line.discountValue !== null
        ? formatRateForInput(line.discountValue, locale)
        : line.discountKind === "amount" && line.discountValue !== null
          ? formatAmountForInput(line.discountValue, currency, locale)
          : "",
    taxRateId: line.taxRateId ?? "",
    sourceKind: "",
    sourceId: "",
  }));
}
