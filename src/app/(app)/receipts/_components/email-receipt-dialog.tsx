"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emailReceiptAction } from "../actions";
import { RecipientsField, useRecipients } from "./recipients-field";

type EmailReceiptDialogProps = { receiptId: string; receiptNumber: string; customerEmail: string | null };

/** Sends a copy of a receipt: to the payer's customer email if there is one, and up to five addresses in all. */
export function EmailReceiptDialog({ receiptId, receiptNumber, customerEmail }: EmailReceiptDialogProps) {
  const router = useRouter();
  const id = useId();
  const email = customerEmail?.toLowerCase() ?? null;
  const [open, setOpen] = useState(false);
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [pending, setPending] = useState(false);
  const recipients = useRecipients(email ? [email] : []);

  async function send() {
    const extras = recipients.add(); // an address typed but not yet added still counts
    if (!extras) return;
    const emails = [...(email && sendToCustomer ? [email] : []), ...extras];
    if (emails.length === 0) {
      recipients.setError("Enter at least one email address.");
      return;
    }
    setPending(true);
    const result = await emailReceiptAction(receiptId, emails);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) recipients.setError(result.errors.recipients ?? null);
      else toast.error(result.error);
      return;
    }
    toast.success(`Sent to ${result.queued === 1 ? "1 person" : `${result.queued} people`}.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <MailIcon aria-hidden="true" />
        Email a copy
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="curious">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <DialogHeader>
              <DialogTitle>{`Email receipt ${receiptNumber}`}</DialogTitle>
              <DialogDescription>They get the receipt&apos;s details in the email. The PDF is for you to download.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              {email && (
                <label htmlFor={`${id}-customer`} className="flex items-start gap-2 text-sm">
                  <Checkbox id={`${id}-customer`} checked={sendToCustomer} onCheckedChange={(checked) => setSendToCustomer(checked === true)} className="mt-0.5" />
                  <span>Send to {email}</span>
                </label>
              )}
              <RecipientsField recipients={recipients} label={email ? "Also send to another email" : "Send to an email"} />
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Not now</DialogClose>
              <Button type="submit" pending={pending} pendingLabel="Sending…">
                Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
