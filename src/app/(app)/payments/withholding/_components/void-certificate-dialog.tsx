"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { eg } from "@/shared/text/example";
import { voidCertificateAction } from "../actions";

type VoidCertificateDialogProps = {
  certificateId: string;
  /** What the market calls the certificate, short ("2307"). */
  short: string;
  payorName: string;
  /** Payments on the certificate: they go back to waiting for one. */
  paymentCount: number;
};

/** Voiding a certificate: kept on the record with a reason; its payments wait for a certificate again. */
export function VoidCertificateDialog({ certificateId, short, payorName, paymentCount }: VoidCertificateDialogProps) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await voidCertificateAction(certificateId, reason);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setReasonError(result.errors.reason ?? null);
      else toast.error(result.error);
      return;
    }
    toast.success(`${short} voided.`, { description: `${payorName}'s ${short} stays on the record, marked void.` });
    setOpen(false);
    setReason("");
    router.refresh();
  }

  const pendingLabel = `${short} pending`;
  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Void
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="concerned" tone="danger">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <DialogHeader>
              <DialogTitle>{`Void this ${short}?`}</DialogTitle>
              <DialogDescription>
                {`Use this when it was recorded by mistake. It stays on the record, marked void.`}
                {paymentCount > 0 &&
                  (paymentCount === 1
                    ? ` The payment on it goes back to "${pendingLabel}".`
                    : ` The ${paymentCount} payments on it go back to "${pendingLabel}".`)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                  Reason
                </label>
                <Textarea
                  id={`${id}-reason`}
                  rows={2}
                  maxLength={500}
                  placeholder={eg("Recorded under the wrong customer.")}
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
                {`Void ${short}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
