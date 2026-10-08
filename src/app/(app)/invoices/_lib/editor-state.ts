import { formatQuantity } from "@/modules/documents/client";
import type { InvoiceDetail } from "@/modules/invoices";
import { toRawQualifiedDiscount } from "@/modules/invoices/client";
import { formatAmountForInput } from "@/shared/money";
import { formatRateForInput } from "@/shared/numbers/percent";
import type { DocumentEditorState } from "../../_documents/document-editor";

/** A saved invoice back into the editor's typed form (drafts, and edits before payment). */
export function toEditorState(invoice: InvoiceDetail, locale: string): DocumentEditorState {
  return {
    customerId: invoice.customerId ?? "",
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    endDate: invoice.dueDate,
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    qualifiedDiscount: toRawQualifiedDiscount(invoice.qualifiedDiscount),
    lines: invoice.lines.map((line) => ({
      key: `line-${line.position}`,
      description: line.description,
      quantity: formatQuantity(line.quantity, locale),
      unitLabel: line.unitLabel,
      unitPrice: formatAmountForInput(line.unitPriceMinor, invoice.currency, locale),
      discountKind: line.discountKind ?? "none",
      discountValue:
        line.discountKind === "percent" && line.discountValue !== null
          ? formatRateForInput(line.discountValue, locale)
          : line.discountKind === "amount" && line.discountValue !== null
            ? formatAmountForInput(line.discountValue, invoice.currency, locale)
            : "",
      taxRateId: line.taxRateId ?? "",
      sourceKind: line.sourceKind ?? "",
      sourceId: line.sourceId ?? "",
    })),
  };
}
