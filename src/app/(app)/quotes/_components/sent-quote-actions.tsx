"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LinkIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { QuoteStatus } from "@/modules/quotes/client";
import { transitionQuote } from "@/modules/quotes/client";
import { cancelQuoteAction, createQuoteLinkAction, reviseQuoteAction } from "../actions";

type SentQuoteActionsProps = {
  id: string;
  status: QuoteStatus;
  /** e.g. "Quotation QUO-000012". */
  name: string;
  shareChannels: string;
};

/**
 * What a business can do with a sent quote. Copying a link is instant;
 * revising and cancelling close the customer's link, so they ask first.
 */
export function SentQuoteActions({ id, status, name, shareChannels }: SentQuoteActionsProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"revise" | "cancel" | null>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();

  const canLink = status !== "CANCELLED";
  const canRevise = transitionQuote(status, "revise").ok;
  const canCancel = transitionQuote(status, "cancel").ok;

  async function copyLink() {
    setPending(true);
    const result = await createQuoteLinkAction(id);
    setPending(false);
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

  async function run(kind: "revise" | "cancel") {
    setPending(true);
    const result = kind === "revise" ? await reviseQuoteAction(id) : await cancelQuoteAction(id, reason);
    setPending(false);
    setConfirm(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(kind === "revise" ? `${name} is open for changes.` : `${name} cancelled.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canLink && (
        <Button type="button" variant="outline" pending={pending && confirm === null} pendingLabel="Copying…" onClick={() => void copyLink()}>
          <LinkIcon aria-hidden="true" />
          Copy link
        </Button>
      )}
      {canRevise && (
        <Button type="button" variant="outline" onClick={() => setConfirm("revise")}>
          <PencilIcon aria-hidden="true" />
          Revise
        </Button>
      )}
      {canCancel && (
        <Button type="button" variant="ghost" onClick={() => setConfirm("cancel")}>
          <Ban aria-hidden="true" />
          Cancel quote
        </Button>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "revise" ? `Revise ${name}?` : `Cancel ${name}?`}</DialogTitle>
            <DialogDescription>
              {confirm === "revise"
                ? "It reopens as the next revision with the same number. The link you sent stops working; send the new version when it's ready."
                : "The customer's link stops working and it can't be approved. Its number stays used."}
            </DialogDescription>
          </DialogHeader>
          {confirm === "cancel" && (
            <div className="grid gap-1.5">
              <label htmlFor={reasonId} className="text-sm font-medium">
                Reason <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep it</DialogClose>
            <Button
              type="button"
              variant={confirm === "cancel" ? "destructive" : "default"}
              pending={pending}
              pendingLabel={confirm === "revise" ? "Reopening…" : "Cancelling…"}
              onClick={() => confirm && void run(confirm)}
            >
              {confirm === "revise" ? "Revise quote" : "Cancel quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
