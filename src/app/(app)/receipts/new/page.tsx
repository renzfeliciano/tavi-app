import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { RECEIPT_KINDS } from "@/config/markets";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { todayIn } from "@/shared/dates/calendar";
import { ReceiptForm } from "../_components/receipt-form";

export const metadata: Metadata = { title: "New receipt" };

// A receipt for money that isn't an invoice payment: who paid, how much, what for.
export default async function NewReceiptPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx, "payments.record")) notFound();
  const { market } = ctx;
  return (
    <>
      <BackLink href={"/receipts" as Route}>Receipts</BackLink>
      <PageHeader title="New receipt" description="For money you received that isn't an invoice payment." />
      <div className="mt-8 max-w-3xl">
        <ReceiptForm
          kinds={RECEIPT_KINDS.map((value) => ({ value, title: market.documents.receiptKinds[value].title }))}
          currency={market.currency}
          locale={ctx.locale}
          today={todayIn(ctx.timezone)}
          methodLabels={market.paymentMethodLabels}
          detailLabels={market.paymentDetailLabels}
          detailExamples={market.paymentDetailExamples}
          chequeDateLabel={market.chequeDateLabel}
          purposeExample={market.examples.receiptPurpose}
          payerExample={market.examples.person}
        />
      </div>
    </>
  );
}
