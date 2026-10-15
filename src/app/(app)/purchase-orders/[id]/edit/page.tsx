import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import {
  getPurchaseOrder,
  newPurchaseOrderDefaults,
} from "@/modules/purchasing";
import { editorContext } from "../../../_documents/editor-props";
import { OrderForm } from "../../_components/order-form";
import { toEditorLines } from "../../_lib/editor-lines";

export const metadata: Metadata = { title: "Edit purchase order" };

// Only a draft can be edited; once issued the order is read-only (cancel it and make a new one).
export default async function EditPurchaseOrderPage({
  params,
}: PageProps<"/purchase-orders/[id]/edit">) {
  const ctx = await requireOrgContext();
  if (!can(ctx, "purchasing.write")) notFound();
  const { id } = await params;
  const order = await getPurchaseOrder(ctx, id);
  if (!order) notFound();
  if (order.status !== "DRAFT")
    redirect(`/purchase-orders/${order.id}` as Route);
  const [defaults, editor] = await Promise.all([
    newPurchaseOrderDefaults(ctx),
    editorContext(ctx, "quote", order.currency),
  ]);
  const { singular, plural } = ctx.market.documents.purchaseOrder;

  return (
    <>
      <BackLink
        href={`/purchase-orders/${order.id}` as Route}
      >{`Draft ${singular.toLowerCase()}`}</BackLink>
      <PageHeader
        title={`Edit draft ${singular.toLowerCase()}`}
        description={`Not saved to your ${plural.toLowerCase()} until you save it or issue it.`}
      />
      <div className="mt-8 max-w-3xl">
        <OrderForm
          orderId={order.id}
          initial={{
            supplier: order.supplier
              ? {
                  id: order.supplier.id,
                  displayName: order.supplier.displayName,
                  detail: order.supplier.email,
                  email: order.supplier.email,
                }
              : null,
            currency: order.currency,
            orderDate: order.orderDate,
            expectedDate: order.expectedDate ?? "",
            notes: order.notes ?? "",
            terms: order.terms ?? "",
            lines: toEditorLines(order.lines, order.currency, ctx.locale),
          }}
          currencies={editor.currencies.map(({ code, label }) => ({
            code,
            label,
          }))}
          taxRates={editor.taxRates}
          defaultTaxRateId={defaults.defaultTaxRateId}
          taxMode={order.taxMode}
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
