"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RECEIPT_LIMITS } from "@/modules/payments/client";
import { eg } from "@/shared/text/example";
import { voidReceiptAction } from "../actions";

type VoidReceiptDialogProps = { receiptId: string; receiptNumber: string };

/** Voiding a receipt: it stays on the record, marked void, with the reason. Its number is never reused. */
export function VoidReceiptDialog({ receiptId, receiptNumber }: VoidReceiptDialogProps) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await voidReceiptAction(receiptId, reason);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setReasonError(result.errors.reason ?? null);
      else toast.error(result.error);
      return;
    }
    toast.success(`Receipt ${receiptNumber} voided.`, { description: "It stays on the record, marked void." });
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Void
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
              <DialogTitle>{`Void receipt ${receiptNumber}?`}</DialogTitle>
              <DialogDescription>Use this when the receipt was made by mistake. It stays on the record, marked void, and its number isn&apos;t used again.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                  Reason
                </label>
                <Textarea
                  id={`${id}-reason`}
                  rows={2}
                  maxLength={RECEIPT_LIMITS.reason}
                  placeholder={eg("Wrong amount.")}
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
              <Button type="submit" variant="destructive" pending={pending} pendingLabel="Voiding…">
                Void receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
