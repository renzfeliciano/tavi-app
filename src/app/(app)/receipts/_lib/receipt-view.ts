import type { AcknowledgementView } from "@/components/document/acknowledgement-paper";
import type { DocumentView } from "@/components/document/document-view";
import type { MarketProfile } from "@/config/markets";
import type { Receipt } from "@/modules/payments";
import { paymentProofRows } from "@/modules/payments/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";

/**
 * A receipt for money that is not an invoice payment, as the same sheet a payment acknowledgement uses (D13: a
 * supplementary document). The web page and the PDF share this.
 */
export function receiptView(
  receipt: Receipt,
  { business, market, locale }: { business: DocumentView["business"]; market: MarketProfile; locale: string },
): AcknowledgementView {
  return {
    title: market.documents.receiptKinds[receipt.kind].title,
    number: receipt.receiptNumber,
    business,
    // The payer's name is copied onto the receipt, so a typed payer and a customer print the same way.
    customer: { name: receipt.payerName, subtitle: null, addressLines: [], contactLines: [], taxId: null },
    details: [
      { label: "Date received", value: formatCalendarDate(receipt.receivedOn, locale) },
      { label: "Method", value: market.paymentMethodLabels[receipt.method] },
      ...paymentProofRows({ ...receipt, payerName: null }, market, (date) => formatCalendarDate(date, locale)),
      { label: "For", value: receipt.purpose },
      ...(receipt.notes ? [{ label: "Note", value: receipt.notes }] : []),
    ],
    amount: formatMoney(receipt.amountMinor, receipt.currency, { locale }),
    voided: receipt.voidedAt ? `Voided: ${receipt.voidReason ?? ""}` : null,
    notice: market.supplementaryDocumentNotice,
    disclaimer: market.documents.receipt.disclaimer ?? null,
  };
}
