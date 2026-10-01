import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AcknowledgementPaper } from "@/components/document/acknowledgement-paper";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, invoiceTitle } from "@/modules/invoices";
import { getPayment } from "@/modules/payments";
import { documentBusiness } from "../../_documents/editor-props";
import { acknowledgementView } from "../_lib/acknowledgement-view";

export const metadata: Metadata = { title: "Payment acknowledgement" };

// One payment's acknowledgement, as the customer would get it (§B.5).
export default async function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const payment = await getPayment(ctx, id);
  if (!payment) notFound();
  const invoice = await getInvoice(ctx, payment.invoiceId);
  if (!invoice) notFound();

  const invoiceName = `${invoiceTitle(invoice, ctx.market)} ${invoice.number ?? ""}`.trim();
  const view = acknowledgementView(payment, {
    invoiceName,
    customer: invoice.customerSnapshot,
    business: await documentBusiness(ctx),
    market: ctx.market,
    locale: ctx.locale,
  });

  return (
    <>
      <BackLink href={`/invoices/${invoice.id}` as Route}>{invoiceName}</BackLink>
      <PageHeader
        title={`${view.title} ${payment.receiptNumber}`}
        description={`For ${invoiceName}.`}
        actions={
          <a href={`/payments/${payment.id}/pdf`} download className={buttonVariants({ variant: "outline" })}>
            <DownloadIcon aria-hidden="true" />
            Download PDF
          </a>
        }
      />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaper view={view} />
      </div>
    </>
  );
}
