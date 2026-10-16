"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { eg } from "@/shared/text/example";
import { emailPurchaseOrderAction } from "../actions";

const MESSAGE_MAX = 1000;

type EmailOrderDialogProps = {
  orderId: string;
  number: string;
  /** The supplier's email, offered first; empty when the supplier has none. */
  supplierEmail: string | null;
  /** A market-appropriate sample address for the empty field. */
  emailExample: string;
};

/** Emails the order's details to the supplier. The PDF is downloaded separately. */
export function EmailOrderDialog({ orderId, number, supplierEmail, emailExample }: EmailOrderDialogProps) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(supplierEmail ?? "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    const address = to.trim();
    const result = await emailPurchaseOrderAction(orderId, { to: address, message });
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setErrors(result.errors);
      else toast.error(result.error);
      return;
    }
    toast.success(`Sent to ${address}.`);
    setOpen(false);
    setMessage("");
    setErrors({});
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <MailIcon aria-hidden="true" />
        Email supplier
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="curious">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <DialogHeader>
              <DialogTitle>{`Email ${number}`}</DialogTitle>
              <DialogDescription>They get the order&apos;s details in the email. The PDF is for you to download.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
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
                    setErrors({});
                  }}
                  aria-invalid={errors.emailTo ? true : undefined}
                  aria-describedby={errors.emailTo ? `${id}-to-error` : undefined}
                />
                {errors.emailTo && (
                  <p id={`${id}-to-error`} className="text-sm text-destructive">
                    {errors.emailTo}
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
