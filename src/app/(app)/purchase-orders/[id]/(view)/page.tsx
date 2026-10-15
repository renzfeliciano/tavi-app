import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DocumentPaper } from "@/components/document/document-paper";
import { StatusBadge } from "@/components/status/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import {
  getPurchaseOrder,
  type PurchaseOrderDetail,
} from "@/modules/purchasing";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { documentBusiness } from "../../../_documents/editor-props";
import { OrderActions } from "../../_components/order-actions";
import { purchaseOrderView } from "../../_lib/po-view";

export const metadata: Metadata = { title: "Purchase order" };

/** One line under the title: who it is for, and what became of it. */
function describe(order: PurchaseOrderDetail, locale: string) {
  const supplier =
    order.supplierSnapshot?.displayName ??
    order.supplier?.displayName ??
    "No supplier yet";
  if (order.status === "RECEIVED" && order.receivedDate) {
    return `${supplier}. Received ${formatCalendarDate(order.receivedDate, locale)}${order.receiptNote ? `: ${order.receiptNote}` : "."}`;
  }
  if (order.status === "CANCELLED")
    return `${supplier}. Cancelled${order.cancelReason ? `: ${order.cancelReason}` : "."}`;
  return supplier;
}

// One purchase order as the supplier would get it. A draft isn't numbered or frozen yet; received and cancelled ones say so on the paper.
export default async function PurchaseOrderPage({
  params,
}: PageProps<"/purchase-orders/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const order = await getPurchaseOrder(ctx, id);
  if (!order) notFound();
  const { singular, plural } = ctx.market.documents.purchaseOrder;
  const view = purchaseOrderView(order, {
    business: await documentBusiness(ctx, order.sellerSnapshot),
    market: ctx.market,
    locale: ctx.locale,
  });

  return (
    <>
      <BackLink href={"/purchase-orders" as Route}>{plural}</BackLink>
      <PageHeader
        title={
          order.number
            ? `${singular} ${order.number}`
            : `Draft ${singular.toLowerCase()}`
        }
        description={describe(order, ctx.locale)}
        actions={
          <>
            <StatusBadge kind="purchase_order" status={order.status} />
            <OrderActions
              orderId={order.id}
              number={order.number ?? ""}
              status={order.status}
              supplierEmail={
                order.supplier?.email ?? order.supplierSnapshot?.email ?? null
              }
              orderDate={order.orderDate}
              today={todayIn(ctx.timezone)}
              emailExample={ctx.market.examples.email}
              canWrite={can(ctx, "purchasing.write")}
              canIssue={can(ctx, "purchasing.issue")}
            />
            {order.status !== "DRAFT" && (
              <a
                href={`/purchase-orders/${order.id}/pdf`}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <DownloadIcon aria-hidden="true" />
                Download PDF
              </a>
            )}
          </>
        }
      />
      <div className="mt-6 max-w-3xl">
        <DocumentPaper view={view} />
      </div>
    </>
  );
}
