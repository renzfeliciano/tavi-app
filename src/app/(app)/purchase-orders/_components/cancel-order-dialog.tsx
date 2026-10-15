"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PO_LIMITS } from "@/modules/purchasing/client";
import { eg } from "@/shared/text/example";
import { cancelPurchaseOrderAction } from "../actions";

type CancelOrderDialogProps = { orderId: string; number: string };

/** Cancelling an issued order: it stays on the record, marked cancelled, with the reason. */
export function CancelOrderDialog({ orderId, number }: CancelOrderDialogProps) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await cancelPurchaseOrderAction(orderId, reason);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setReasonError(result.errors.reason ?? null);
      else {
        setReasonError(result.error);
        toast.error(result.error);
      }
      return;
    }
    toast.success(`${number} cancelled.`, { description: "It stays on the record, marked cancelled." });
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="concerned" tone="danger">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <DialogHeader>
              <DialogTitle>{`Cancel ${number}?`}</DialogTitle>
              <DialogDescription>Use this when the order shouldn&apos;t go ahead. It stays on the record, marked cancelled, and its number isn&apos;t used again.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                  Reason
                </label>
                <Textarea
                  id={`${id}-reason`}
                  rows={2}
                  maxLength={PO_LIMITS.cancelReason}
                  placeholder={eg("Supplier is out of stock.")}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError(null);
                  }}
                  aria-invalid={reasonError ? true : undefined}
                  aria-describedby={reasonError ? `${id}-reason-error` : undefined}
                />
                {reasonError && (
                  <p id={`${id}-reason-error`} className="text-sm text-destructive">
                    {reasonError}
                  </p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
              <Button type="submit" variant="destructive" pending={pending} pendingLabel="Cancelling…">
                Cancel purchase order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
