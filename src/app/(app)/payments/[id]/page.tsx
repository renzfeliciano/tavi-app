import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DownloadIcon, FilePlus2Icon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AcknowledgementPaper } from "@/components/document/acknowledgement-paper";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, invoiceTitle } from "@/modules/invoices";
import { getPayment, paymentWithholdingStatus } from "@/modules/payments";
import { documentBusiness } from "../../_documents/editor-props";
import { WithholdingBadge } from "../_components/withholding-badge";
import { acknowledgementView } from "../_lib/acknowledgement-view";
import { deletePaymentAction } from "../actions";

export const metadata: Metadata = { title: "Payment acknowledgement" };

// One payment's acknowledgement, as the customer would get it (§B.5).
export default async function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const payment = await getPayment(ctx, id);
  if (!payment) notFound();
  const invoice = await getInvoice(ctx, payment.invoiceId);
  if (!invoice) notFound();

  // Where the tax this customer withheld stands on its 2307 (markets with no withheld tax show nothing).
  const certificate = ctx.market.taxWithheld?.certificate ?? null;
  const withholding = certificate ? ((await paymentWithholdingStatus(ctx, [payment.id])).get(payment.id) ?? "none") : "none";
  const canRecordCertificate = certificate !== null && withholding === "pending" && invoice.customerId !== null && can(ctx, "payments.record");

  const invoiceName = `${invoiceTitle(invoice, ctx.market)} ${invoice.number ?? ""}`.trim();
  const view = acknowledgementView(payment, {
    invoiceName,
    customer: invoice.customerSnapshot,
    business: await documentBusiness(ctx, invoice.sellerSnapshot),
    market: ctx.market,
    locale: ctx.locale,
  });

  return (
    <>
      <BackLink href={`/invoices/${invoice.id}` as Route}>{invoiceName}</BackLink>
      <PageHeader
        title={`${view.title} ${payment.receiptNumber}`}
        description={
          certificate && withholding !== "none" ? (
            // The compact badge is as tall as the line of small text it leads, so the header keeps its height.
            <span className="inline-flex items-center gap-2">
              <WithholdingBadge status={withholding} certificate={certificate.short} compact />
              <span>For {invoiceName}.</span>
            </span>
          ) : (
            `For ${invoiceName}.`
          )
        }
        actions={
          <>
            {canRecordCertificate && certificate && invoice.customerId && (
              <Link
                href={`/payments/withholding/new?customer=${invoice.customerId}` as Route}
                className={buttonVariants({ variant: "outline" })}
              >
                <FilePlus2Icon aria-hidden="true" />
                Record {certificate.short}
              </Link>
            )}
            <a href={`/payments/${payment.id}/pdf`} download className={buttonVariants({ variant: "outline" })}>
              <DownloadIcon aria-hidden="true" />
              Download PDF
            </a>
            {payment.voidedAt !== null && can(ctx, "records.delete") && (
              <DeleteRecordButton
                name={`${view.title} ${payment.receiptNumber}`}
                description="It's already void, so the balance doesn't change."
                remove={deletePaymentAction.bind(null, payment.id)}
                redirectTo={`/invoices/${invoice.id}`}
              />
            )}
          </>
        }
      />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaper view={view} />
      </div>
    </>
  );
}
