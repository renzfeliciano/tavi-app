import Link from "next/link";
import type { Route } from "next";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchaseOrderStatus } from "@/modules/purchasing/client";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { DeleteDraftDialog } from "./delete-draft-dialog";
import { EmailOrderDialog } from "./email-order-dialog";
import { ReceiveOrderDialog } from "./receive-order-dialog";

type OrderActionsProps = {
  orderId: string;
  number: string;
  status: PurchaseOrderStatus;
  supplierEmail: string | null;
  orderDate: string;
  today: string;
  emailExample: string;
  /** purchasing.write: edit or delete a draft. */
  canWrite: boolean;
  /** purchasing.issue: email, receive and cancel. */
  canIssue: boolean;
};

/**
 * What can be done with an order now: Edit and Delete on a draft; Email, Mark received and Cancel
 * while it is issued; Email again once received; nothing once cancelled. Download is a separate link.
 */
export function OrderActions({ orderId, number, status, supplierEmail, orderDate, today, emailExample, canWrite, canIssue }: OrderActionsProps) {
  if (status === "DRAFT" && canWrite) {
    return (
      <>
        <Button variant="outline" render={<Link href={`/purchase-orders/${orderId}/edit` as Route} />}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Button>
        <DeleteDraftDialog orderId={orderId} />
      </>
    );
  }
  if (!canIssue) return null;
  if (status === "ISSUED") {
    return (
      <>
        <EmailOrderDialog orderId={orderId} number={number} supplierEmail={supplierEmail} emailExample={emailExample} />
        <ReceiveOrderDialog orderId={orderId} number={number} today={today} orderDate={orderDate} />
        <CancelOrderDialog orderId={orderId} number={number} />
      </>
    );
  }
  if (status === "RECEIVED") {
    return <EmailOrderDialog orderId={orderId} number={number} supplierEmail={supplierEmail} emailExample={emailExample} />;
  }
  return null;
}
