"use client";

import { useId, useState } from "react";
import { LinkIcon, MailIcon } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DELIVERY_LIMITS } from "@/modules/documents/client";
import type { Delivery } from "./editor-types";

export type DeliveryOutcome = { ok: true } | { ok: false; error?: string; emailError?: string };

type SendDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Quotation". */
  title: string;
  customerName: string | null;
  customerEmail: string | null;
  businessName: string;
  /** e.g. "Messenger or Viber", from the market. */
  shareChannels: string;
  /** Sending needs the sender's own email confirmed (§D). */
  emailVerified: boolean;
  /** Something to check before sending, e.g. the buyer's TIN on a registered invoice. */
  reminder?: string | null;
  onSend: (delivery: Delivery) => Promise<DeliveryOutcome>;
};

/** Email and "copy link" are equals: many customers get documents in a chat (§G.3). */
export function SendDocumentDialog(props: SendDocumentDialogProps) {
  const { title, customerName, customerEmail, businessName } = props;
  const [mode, setMode] = useState<Delivery["mode"]>(customerEmail ? "email" : "link");
  const [to, setTo] = useState(customerEmail ?? "");
  const firstName = customerName?.split(" ")[0] ?? "";
  const [message, setMessage] = useState(
    `Hi${firstName ? ` ${firstName}` : ""},\n\nHere's our ${title.toLowerCase()}. Let us know if you have any questions.\n\n${businessName}`,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const toId = useId();
  const messageId = useId();

  async function submit() {
    setPending(true);
    setError(null);
    setEmailError(null);
    const outcome = await props.onSend(mode === "email" ? { mode, to, message } : { mode });
    setPending(false);
    if (!outcome.ok) {
      setError(outcome.error ?? null);
      setEmailError(outcome.emailError ?? null);
    }
  }

  const choice = (value: Delivery["mode"], Icon: typeof MailIcon, label: string, detail: string) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border border-border p-3 transition-colors duration-(--duration-fast) hover:border-border-strong has-checked:border-stamp has-checked:bg-stamp-subtle has-focus-visible:ring-3 has-focus-visible:ring-ring/35",
      )}
    >
      <input
        type="radio"
        name="delivery"
        value={value}
        checked={mode === value}
        onChange={() => setMode(value)}
        className="mt-0.5 size-4 accent-stamp"
      />
      <span className="grid gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {title.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {customerName ? `To ${customerName}. ` : ""}They can open it on any phone; no account needed.
          </DialogDescription>
        </DialogHeader>

        {!props.emailVerified ? (
          <FormAlert message="Confirm your email address before sending. Use the link we emailed you, or resend it from the banner at the top of the page." />
        ) : (
          <div className="grid gap-4">
            <FormAlert message={error} />
            {props.reminder && (
              <p role="note" className="rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-sm text-pretty">
                {props.reminder}
              </p>
            )}
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">How to send</legend>
              {choice("email", MailIcon, "Email it", "We email the link from you.")}
              {choice("link", LinkIcon, "Copy link", `Paste it into ${props.shareChannels}.`)}
            </fieldset>
            {mode === "email" && (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <label htmlFor={toId} className="text-sm font-medium">
                    To
                  </label>
                  <Input
                    id={toId}
                    type="email"
                    maxLength={DELIVERY_LIMITS.emailTo}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? `${toId}-error` : undefined}
                  />
                  {emailError && (
                    <p id={`${toId}-error`} className="text-sm text-destructive">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={messageId} className="text-sm font-medium">
                    Message
                  </label>
                  <Textarea id={messageId} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={DELIVERY_LIMITS.message} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Not yet</DialogClose>
          <Button
            type="button"
            disabled={!props.emailVerified}
            pending={pending}
            pendingLabel={mode === "email" ? "Sending…" : "Opening link…"}
            onClick={() => void submit()}
          >
            {mode === "email" ? "Send email" : "Mark as sent and copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
