import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AcknowledgementPaper } from "@/components/document/acknowledgement-paper";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { getReceipt } from "@/modules/payments";
import { documentBusiness } from "../../../_documents/editor-props";
import { ReceiptActions } from "../../_components/receipt-actions";
import { receiptView } from "../../_lib/receipt-view";

export const metadata: Metadata = { title: "Receipt" };

// One receipt as the payer would get it. A voided receipt says so on the paper.
export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const receipt = await getReceipt(ctx, id);
  if (!receipt) notFound();
  const customer = receipt.customerId ? await getCustomer(ctx, receipt.customerId) : null;
  const view = receiptView(receipt, {
    business: await documentBusiness(ctx, receipt.seller),
    market: ctx.market,
    locale: ctx.locale,
  });

  return (
    <>
      <BackLink href="/receipts">Receipts</BackLink>
      <PageHeader
        title={`${view.title} ${receipt.receiptNumber}`}
        description={`Received from ${receipt.payerName}.`}
        actions={
          <>
            <ReceiptActions
              receiptId={receipt.id}
              receiptNumber={receipt.receiptNumber}
              customerEmail={customer?.email ?? null}
              canEmail={can(ctx, "payments.record")}
              canVoid={can(ctx, "payments.void")}
              voided={receipt.voidedAt !== null}
            />
            <a href={`/receipts/${receipt.id}/pdf`} download className={buttonVariants({ variant: "outline" })}>
              <DownloadIcon aria-hidden="true" />
              Download PDF
            </a>
          </>
        }
      />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaper view={view} />
      </div>
    </>
  );
}
