"use client";

import { useId } from "react";
import { SendDocumentDialog } from "@/app/(app)/_documents/send-document-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SampleId } from "./sample-list";

type SampleProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Same copy and shape as the real modals, with nothing behind the buttons. */
function DangerSample({ open, onOpenChange }: SampleProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mascot="concerned" tone="danger">
        <DialogHeader>
          <DialogTitle>Delete this draft forever?</DialogTitle>
          <DialogDescription>
            Quotation QT-0042 for Juan Dela Cruz will be gone for good, and its number will not be used again. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Keep it</DialogClose>
          <DialogClose render={<Button type="button" variant="destructive" />}>Delete forever</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentSample({ open, onOpenChange }: SampleProps) {
  const id = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mascot="curious">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Invoice INV-0017 · Juan Dela Cruz · balance ₱12,500.00</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-amount`} className="text-sm font-medium">
              Amount received
            </label>
            <Input id={`${id}-amount`} inputMode="decimal" defaultValue="12,500.00" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              Date received
            </label>
            <Input id={`${id}-date`} type="date" defaultValue="2026-10-13" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-withheld`} className="text-sm font-medium">
              Tax withheld by the customer (optional)
            </label>
            <Input id={`${id}-withheld`} inputMode="decimal" defaultValue="0.00" aria-describedby={`${id}-withheld-hint`} />
            <p id={`${id}-withheld-hint`} className="text-sm text-muted-foreground">
              If they gave you a Form 2307, enter the amount on it.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox defaultChecked className="mt-0.5" />
            <span>Email a payment acknowledgement to juan@example.com</span>
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button type="button" />}>Record payment</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendSample({ open, onOpenChange }: SampleProps) {
  return (
    <SendDocumentDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quotation"
      customerName="Juan Dela Cruz"
      customerEmail="juan@example.com"
      businessName="Santos Aircon"
      shareChannels="Messenger or Viber"
      emailVerified
      reminder={null}
      onSend={async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        onOpenChange(false);
        return { ok: true };
      }}
    />
  );
}

function IdleSample({ open, onOpenChange }: SampleProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} mascot="waiting">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            For your security, you&apos;ll be signed out in 42 seconds. Anything you haven&apos;t saved will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button autoFocus />}>Stay signed in</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NeutralSample({ open, onOpenChange }: SampleProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mascot="neutral">
        <DialogHeader>
          <DialogTitle>Sign out other devices?</DialogTitle>
          <DialogDescription>
            You&apos;re signed in on 2 other devices. They&apos;ll be signed out right away; this one stays signed in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button type="button" />}>Sign out other devices</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TAX_RATES = [
  ["VAT", "12%"],
  ["VAT zero-rated", "0%"],
  ["VAT exempt", "0%"],
  ["Percentage tax", "3%"],
  ["Expanded withholding (goods)", "1%"],
  ["Expanded withholding (services)", "2%"],
  ["Professional fees (individual)", "5%"],
  ["Professional fees (over ₱3M)", "10%"],
  ["Rentals", "5%"],
  ["Commissions", "10%"],
  ["Contractors", "2%"],
  ["Government money payments", "1%"],
  ["Final withholding", "20%"],
  ["Other", "0%"],
] as const;

function LongSample({ open, onOpenChange }: SampleProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mascot="curious">
        <DialogHeader>
          <DialogTitle>Tax rates</DialogTitle>
          <DialogDescription>Choose the rates that show up when you make a quote or invoice.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {TAX_RATES.map(([name, rate]) => (
              <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span>{name}</span>
                <span className="font-mono text-muted-foreground tabular-nums">{rate}</span>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button type="button" />}>Save rates</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const BY_ID: Record<SampleId, (props: SampleProps) => React.JSX.Element> = {
  danger: DangerSample,
  payment: PaymentSample,
  send: SendSample,
  idle: IdleSample,
  neutral: NeutralSample,
  long: LongSample,
};

export function SampleModal({ id, ...props }: SampleProps & { id: SampleId }) {
  const Sample = BY_ID[id];
  return <Sample {...props} />;
}
