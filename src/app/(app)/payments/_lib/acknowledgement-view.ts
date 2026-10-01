import type { AcknowledgementView } from "@/components/document/acknowledgement-paper";
import type { DocumentView } from "@/components/document/document-view";
import type { MarketProfile, PaymentMethod } from "@/config/markets";
import type { CustomerSnapshot } from "@/modules/quotes";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";

/** A payment as its acknowledgement (§B.5): the web page and the PDF share this. */
export function acknowledgementView(
  payment: {
    receiptNumber: string;
    paidOn: string;
    method: PaymentMethod;
    reference: string | null;
    amountMinor: number;
    withheldMinor: number;
    currency: string;
    voidedAt?: Date | null;
    voidReason?: string | null;
  },
  {
    invoiceName,
    customer,
    business,
    market,
    locale,
  }: {
    /** e.g. "Billing statement INV-000001". */
    invoiceName: string;
    customer: CustomerSnapshot | null;
    business: DocumentView["business"];
    market: MarketProfile;
    locale: string;
  },
): AcknowledgementView {
  const money = (minor: number) => formatMoney(minor, payment.currency, { locale });
  return {
    title: market.documents.receipt.singular,
    number: payment.receiptNumber,
    business,
    customer: customer
      ? {
          name: customer.displayName,
          subtitle: customer.company,
          addressLines: customer.addressLines,
          contactLines: [],
          taxId: customer.taxId ? { label: market.taxId.label, value: customer.taxId } : null,
        }
      : null,
    details: [
      { label: "Date received", value: formatCalendarDate(payment.paidOn, locale) },
      { label: "Method", value: market.paymentMethodLabels[payment.method] },
      ...(payment.reference ? [{ label: "Reference", value: payment.reference }] : []),
      { label: "For", value: invoiceName },
      ...(payment.withheldMinor > 0 && market.taxWithheld
        ? [{ label: market.taxWithheld.label, value: money(payment.withheldMinor) }]
        : []),
    ],
    amount: money(payment.amountMinor),
    voided: payment.voidedAt ? `Voided: ${payment.voidReason ?? ""}` : null,
    // Payment acknowledgements are supplementary documents (RR 7-2024 Sec. 6 B.15, D13).
    notice: market.supplementaryDocumentNotice,
    disclaimer: market.documents.receipt.disclaimer ?? null,
  };
}
