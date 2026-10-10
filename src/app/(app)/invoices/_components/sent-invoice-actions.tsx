"use client";

import { reminderMessage } from "@/lib/reminder-message";
import { shareLink } from "@/lib/share-link";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CopyPlusIcon, DownloadIcon, FileJsonIcon, FileXIcon, LinkIcon, PencilIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { INVOICE_REASON_MAX, type InvoiceStatus, transitionInvoice } from "@/modules/invoices/client";
import {
  cancelInvoiceAction,
  createInvoiceLinkAction,
  voidAndDuplicateInvoiceAction,
  voidInvoiceAction,
} from "../actions";

type SentInvoiceActionsProps = {
  id: string;
  status: InvoiceStatus;
  /** e.g. "Billing statement INV-000001". */
  name: string;
  amountPaidMinor: number;
  /** A registered invoice can't be edited once issued (D14); void & duplicate is the correction. */
  registered: boolean;
  /** A registered invoice already printed once: its next PDF says "REPRINT" (D19). */
  printed: boolean;
  /** A registered invoice the person may export as e-invoice JSON (D19, reports.read). */
  eInvoice: boolean;
  /** Void and cancel need the invoices.void capability (checked again on the server). */
  canVoid: boolean;
  shareChannels: string;
  /** What's still owed, for the payment reminder. Nothing owed, no reminder. */
  reminder: {
    customerName: string | null;
    businessName: string;
    balanceMinor: number;
    currency: string;
    locale: string;
    dueDate: string;
    today: string;
  } | null;
};

type Correction = "void" | "cancel" | "duplicate";

const COPY: Record<Correction, { title: string; body: string; button: string; pending: string }> = {
  duplicate: {
    title: "Void and duplicate",
    body: "It's marked void (its number stays used) and a new draft opens with the same customer and items, for you to correct and send.",
    button: "Void and duplicate",
    pending: "Working…",
  },
  void: {
    title: "Void",
    body: "Use this when it was issued in error. It's kept with its number, excluded from your totals, and the customer's link says it was voided.",
    button: "Void",
    pending: "Voiding…",
  },
  cancel: {
    title: "Cancel",
    body: "Use this when the sale was called off. It's kept with its number and shown as cancelled; the customer's link says so.",
    button: "Cancel it",
    pending: "Cancelling…",
  },
};

/**
 * What a business can do with an issued invoice (§B.4). Editing is allowed
 * until a payment (D7); void, cancel and void & duplicate ask for a reason,
 * because they can't be undone.
 */
export function SentInvoiceActions({
  id,
  status,
  name,
  amountPaidMinor,
  registered,
  printed,
  eInvoice,
  canVoid,
  shareChannels,
  reminder,
}: SentInvoiceActionsProps) {
  const router = useRouter();
  const [linking, setLinking] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [open, setOpen] = useState<Correction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  const unpaid = amountPaidMinor === 0;
  const canEdit = transitionInvoice(status, "edit").ok && unpaid && !registered;
  const canClose = canVoid && transitionInvoice(status, "void").ok && unpaid;
  const closed = status === "VOID" || status === "CANCELLED";

  async function copyLink() {
    setLinking(true);
    const result = await createInvoiceLinkAction(id);
    setLinking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const outcome = await shareLink({ url: result.url, title: name, text: `${name}:` });
    if (outcome === "copied") toast.success("Link copied.", { description: `Paste it into ${shareChannels}.` });
    else if (outcome === "manual") toast.success("Here's the link.", { description: result.url, duration: 20_000 });
  }

  async function remind() {
    if (!reminder) return;
    setReminding(true);
    const result = await createInvoiceLinkAction(id);
    setReminding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const text = reminderMessage({
      ...reminder,
      documentName: name,
      paidMinor: amountPaidMinor,
      url: result.url,
    });
    const outcome = await shareLink({ title: name, text });
    if (outcome === "copied") toast.success("Reminder copied.", { description: `Paste it into ${shareChannels}.` });
    else if (outcome === "manual") toast.success("Here's the reminder.", { description: text, duration: 30_000 });
  }

  function show(kind: Correction) {
    setReason("");
    setReasonError(null);
    setOpen(kind);
  }

  async function run() {
    if (!open) return;
    setPending(true);
    if (open === "duplicate") {
      const result = await voidAndDuplicateInvoiceAction(id, reason);
      setPending(false);
      if (!result.ok) {
        if ("errors" in result) setReasonError(result.errors.reason ?? null);
        else toast.error(result.error);
        return;
      }
      setOpen(null);
      toast.success(`${name} voided. A corrected copy is ready to edit.`);
      router.push(`/invoices/${result.duplicateId}`);
      return;
    }
    const result = open === "void" ? await voidInvoiceAction(id, reason) : await cancelInvoiceAction(id, reason);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setReasonError(result.errors.reason ?? null);
      else toast.error(result.error);
      return;
    }
    setOpen(null);
    toast.success(`${name} ${open === "void" ? "voided" : "cancelled"}.`);
    router.refresh();
  }

  const copy = open ? COPY[open] : null;

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/invoices/${id}/pdf`} download className={buttonVariants({ variant: "outline" })}>
        <DownloadIcon aria-hidden="true" />
        {registered && printed ? "Download reprint" : "Download PDF"}
      </a>
      {eInvoice && (
        <a href={`/invoices/${id}/e-invoice`} download className={buttonVariants({ variant: "outline" })}>
          <FileJsonIcon aria-hidden="true" />
          Download e-invoice
        </a>
      )}
      {!closed && (
        <Button type="button" variant="outline" pending={linking} pendingLabel="Copying…" onClick={() => void copyLink()}>
          <LinkIcon aria-hidden="true" />
          Copy link
        </Button>
      )}
      {!closed && reminder && reminder.balanceMinor > 0 && (
        <Button type="button" variant="outline" pending={reminding} pendingLabel="Preparing…" onClick={() => void remind()}>
          <SendIcon aria-hidden="true" />
          Remind
        </Button>
      )}
      {canEdit && (
        <Link href={`/invoices/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Link>
      )}
      {canClose && (
        <>
          <Button type="button" variant="outline" onClick={() => show("duplicate")}>
            <CopyPlusIcon aria-hidden="true" />
            Void and duplicate
          </Button>
          <Button type="button" variant="ghost" onClick={() => show("void")}>
            <FileXIcon aria-hidden="true" />
            Void
          </Button>
          <Button type="button" variant="ghost" onClick={() => show("cancel")}>
            <Ban aria-hidden="true" />
            Cancel
          </Button>
        </>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => !next && !pending && setOpen(null)}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
          >
            <DialogHeader>
              <DialogTitle>{copy ? `${copy.title} ${name}?` : ""}</DialogTitle>
              <DialogDescription>{copy?.body}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <label htmlFor={reasonId} className="text-sm font-medium">
                Reason
              </label>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                rows={2}
                maxLength={INVOICE_REASON_MAX}
                aria-invalid={reasonError ? true : undefined}
                aria-describedby={reasonError ? `${reasonId}-error` : undefined}
              />
              {reasonError && (
                <p id={`${reasonId}-error`} className="text-sm text-destructive">
                  {reasonError}
                </p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
              <Button type="submit" variant="destructive" pending={pending} pendingLabel={copy?.pending ?? ""}>
                {copy?.button}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
