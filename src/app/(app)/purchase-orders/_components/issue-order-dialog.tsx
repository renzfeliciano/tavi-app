"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { eg } from "@/shared/text/example";

const MESSAGE_MAX = 1000;

export type IssueEmail = { to: string; message: string };

type IssueOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The supplier's email, offered as the place to send it; null when they have none. */
  supplierEmail: string | null;
  /** Whether the person's own address is confirmed, which sending an order needs. */
  canEmail: boolean;
  emailExample: string;
  pending: boolean;
  /** The server's complaint about the address, shown beside it. */
  emailError: string | null;
  /** Called with who to email, or null to issue without emailing. */
  onConfirm: (email: IssueEmail | null) => void;
  onEmailEdited: () => void;
};

/** Issuing gives the order its number and locks it, so it asks first, and offers to email the supplier in the same step. */
export function IssueOrderDialog({ open, onOpenChange, supplierEmail, canEmail, emailExample, pending, emailError, onConfirm, onEmailEdited }: IssueOrderDialogProps) {
  const id = useId();
  const [sendEmail, setSendEmail] = useState(supplierEmail !== null);
  const [to, setTo] = useState(supplierEmail ?? "");
  const [message, setMessage] = useState("");

  function confirm() {
    if (canEmail && sendEmail) {
      if (to.trim() === "") {
        toast.error("Enter the supplier's email address, or clear the box to issue without emailing.");
        return;
      }
      onConfirm({ to: to.trim(), message });
      return;
    }
    onConfirm(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent mascot="curious">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <DialogHeader>
            <DialogTitle>Issue this purchase order?</DialogTitle>
            <DialogDescription>It gets its number now and can&apos;t be edited after. To change it later, cancel it and make a new one.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {canEmail && (
              <>
                <label htmlFor={`${id}-send`} className="flex items-start gap-2 text-sm">
                  <Checkbox id={`${id}-send`} checked={sendEmail} onCheckedChange={(checked) => setSendEmail(checked === true)} className="mt-0.5" />
                  <span>Email it to the supplier now</span>
                </label>
                {sendEmail && (
                  <>
                    <div className="grid gap-1.5">
                      <label htmlFor={`${id}-to`} className="text-sm font-medium">
                        Send to
                      </label>
                      <Input
                        id={`${id}-to`}
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        placeholder={eg(emailExample)}
                        value={to}
                        onChange={(event) => {
                          setTo(event.target.value);
                          onEmailEdited();
                        }}
                        aria-invalid={emailError ? true : undefined}
                        aria-describedby={emailError ? `${id}-to-error` : undefined}
                      />
                      {emailError && (
                        <p id={`${id}-to-error`} className="text-sm text-destructive">
                          {emailError}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <label htmlFor={`${id}-message`} className="text-sm font-medium">
                        Message <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <Textarea
                        id={`${id}-message`}
                        rows={3}
                        maxLength={MESSAGE_MAX}
                        placeholder={eg("Please confirm you got this.")}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Not yet</DialogClose>
            <Button type="submit" pending={pending} pendingLabel="Issuing…">
              Issue purchase order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
