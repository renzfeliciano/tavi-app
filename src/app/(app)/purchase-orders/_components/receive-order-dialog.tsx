"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PO_LIMITS } from "@/modules/purchasing/client";
import { eg } from "@/shared/text/example";
import { receivePurchaseOrderAction } from "../actions";

type ReceiveOrderDialogProps = {
  orderId: string;
  number: string;
  /** Today in the business's time zone (yyyy-mm-dd): the default and the latest date allowed. */
  today: string;
  /** The order date: the earliest date allowed. */
  orderDate: string;
};

/** Marks an issued order received: the date it arrived and an optional note. No partial receipts. */
export function ReceiveOrderDialog({ orderId, number, today, orderDate }: ReceiveOrderDialogProps) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [receivedDate, setReceivedDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await receivePurchaseOrderAction(orderId, { receivedDate, note });
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setErrors(result.errors);
      else toast.error(result.error);
      return;
    }
    toast.success(`${number} marked received.`);
    setOpen(false);
    setNote("");
    setErrors({});
    router.refresh();
  }

  const field = (name: string) => ({
    id: `${id}-${name}`,
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const problem = (name: string) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PackageCheckIcon aria-hidden="true" />
        Mark received
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="happy">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <DialogHeader>
              <DialogTitle>{`Mark ${number} received?`}</DialogTitle>
              <DialogDescription>Record the day it arrived. This doesn&apos;t change anything else.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-receivedDate`} className="text-sm font-medium">
                  Date received
                </label>
                <Input
                  {...field("receivedDate")}
                  type="date"
                  min={orderDate}
                  max={today}
                  value={receivedDate}
                  onChange={(event) => {
                    setReceivedDate(event.target.value);
                    setErrors((current) => ({ ...current, receivedDate: "" }));
                  }}
                />
                {problem("receivedDate")}
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-note`} className="text-sm font-medium">
                  Note <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  {...field("note")}
                  rows={2}
                  maxLength={PO_LIMITS.receiptNote}
                  placeholder={eg("Two boxes short.")}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setErrors((current) => ({ ...current, note: "" }));
                  }}
                />
                {problem("note")}
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Not yet</DialogClose>
              <Button type="submit" pending={pending} pendingLabel="Saving…">
                Mark as received
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
