import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AcknowledgementPaper } from "@/components/document/acknowledgement-paper";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice } from "@/modules/invoices";
import { getPayment } from "@/modules/payments";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { documentBusiness } from "../../_documents/editor-props";

export const metadata: Metadata = { title: "Payment acknowledgement" };

// One payment's acknowledgement, as the customer would get it (§B.5). PDFs
// arrive in 1.9.
export default async function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const payment = await getPayment(ctx, id);
  if (!payment) notFound();
  const invoice = await getInvoice(ctx, payment.invoiceId);
  if (!invoice) notFound();

  const { market } = ctx;
  const money = (minor: number) => formatMoney(minor, payment.currency, { locale: ctx.locale });
  const invoiceName = `${market.documents.invoice.singular} ${invoice.number ?? ""}`.trim();
  const snapshot = invoice.customerSnapshot;
  const title = market.documents.receipt.singular;

  return (
    <>
      <BackLink href={`/invoices/${invoice.id}` as Route}>{invoiceName}</BackLink>
      <PageHeader title={`${title} ${payment.receiptNumber}`} description={`For ${invoiceName}.`} />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaper
          view={{
            title,
            number: payment.receiptNumber,
            business: await documentBusiness(ctx),
            customer: snapshot
              ? {
                  name: snapshot.displayName,
                  subtitle: snapshot.company,
                  addressLines: snapshot.addressLines,
                  contactLines: [],
                  taxId: snapshot.taxId ? { label: market.taxId.label, value: snapshot.taxId } : null,
                }
              : null,
            details: [
              { label: "Date received", value: formatCalendarDate(payment.paidOn, ctx.locale) },
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
          }}
        />
      </div>
    </>
  );
}
