import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { newPurchaseOrderDefaults } from "@/modules/purchasing";
import { editorContext } from "../../_documents/editor-props";
import { OrderForm } from "../_components/order-form";

export const metadata: Metadata = { title: "New purchase order" };

// Nothing is saved until Save draft or Issue, so opening this page never leaves an empty draft behind.
export default async function NewPurchaseOrderPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx, "purchasing.write")) notFound();
  const defaults = await newPurchaseOrderDefaults(ctx);
  const editor = await editorContext(ctx, "quote", defaults.currency);
  const { singular, plural } = ctx.market.documents.purchaseOrder;

  return (
    <>
      <BackLink href={"/purchase-orders" as Route}>{plural}</BackLink>
      <PageHeader
        title={`New ${singular.toLowerCase()}`}
        description="Choose the supplier, add what you're ordering, then save a draft or issue it."
      />
      <div className="mt-8 max-w-3xl">
        <OrderForm
          orderId={null}
          initial={{
            supplier: null,
            currency: defaults.currency,
            orderDate: defaults.orderDate,
            expectedDate: "",
            notes: defaults.notes,
            terms: defaults.terms,
            lines: [],
          }}
          currencies={editor.currencies.map(({ code, label }) => ({
            code,
            label,
          }))}
          taxRates={editor.taxRates}
          defaultTaxRateId={defaults.defaultTaxRateId}
          taxMode={defaults.taxMode}
          units={editor.units}
          defaultUnit={editor.defaultUnit}
          lineExample={editor.lineExample}
          locale={ctx.locale}
          emailVerified={ctx.emailVerified}
          emailExample={ctx.market.examples.email}
        />
      </div>
    </>
  );
}
