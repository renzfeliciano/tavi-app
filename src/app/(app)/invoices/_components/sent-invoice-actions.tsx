"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CopyPlusIcon, FileXIcon, LinkIcon, PencilIcon } from "lucide-react";
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
  /** Void and cancel need the invoices.void capability (checked again on the server). */
  canVoid: boolean;
  shareChannels: string;
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
export function SentInvoiceActions({ id, status, name, amountPaidMinor, canVoid, shareChannels }: SentInvoiceActionsProps) {
  const router = useRouter();
  const [linking, setLinking] = useState(false);
  const [open, setOpen] = useState<Correction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  const unpaid = amountPaidMinor === 0;
  const canEdit = transitionInvoice(status, "edit").ok && unpaid;
  const canClose = canVoid && transitionInvoice(status, "void").ok && unpaid;
  if (status === "VOID" || status === "CANCELLED") return null;

  async function copyLink() {
    setLinking(true);
    const result = await createInvoiceLinkAction(id);
    setLinking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success("Link copied.", { description: `Paste it into ${shareChannels}.` });
    } catch {
      toast.success("Here's the link.", { description: result.url, duration: 20_000 });
    }
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
      <Button type="button" variant="outline" pending={linking} pendingLabel="Copying…" onClick={() => void copyLink()}>
        <LinkIcon aria-hidden="true" />
        Copy link
      </Button>
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
