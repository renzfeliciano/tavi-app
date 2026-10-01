"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { QUOTE_DECISION_LIMITS } from "@/modules/quotes/client";
import { decideQuoteAction } from "./actions";

type QuoteDecisionProps = {
  token: string;
  contentHash: string;
  /** e.g. "Quotation QUO-000012". */
  name: string;
  businessName: string;
};

/**
 * Approve (primary, sticky at the bottom on phones) or decline (secondary),
 * each confirmed in a small dialog (§G.4).
 */
export function QuoteDecision({ token, contentHash, name, businessName }: QuoteDecisionProps) {
  const router = useRouter();
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [pending, setPending] = useState(false);
  const [approver, setApprover] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useId();
  const acceptId = useId();
  const reasonId = useId();

  function show(kind: "approve" | "reject") {
    setErrors({});
    setFormError(null);
    setOpen(kind);
  }

  async function submit() {
    if (!open) return;
    setPending(true);
    const result = await decideQuoteAction(
      token,
      open === "approve" ? { kind: "approve", name: approver, accepted } : { kind: "reject", reason },
      contentHash,
    );
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) {
        setErrors(result.errors);
        setFormError(null);
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
      return;
    }
    setOpen(null);
    toast.success(
      result.status === "APPROVED" ? `You approved ${name}.` : `You declined ${name}.`,
      { description: `${businessName} has been told.` },
    );
    router.refresh();
  }

  return (
    <>
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="button" size="lg" className="flex-1 sm:flex-none" onClick={() => show("approve")}>
          <CheckIcon aria-hidden="true" />
          Approve quote
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => show("reject")}>
          <XIcon aria-hidden="true" />
          Decline
        </Button>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && !pending && setOpen(null)}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{open === "approve" ? `Approve ${name}?` : `Decline ${name}?`}</DialogTitle>
              <DialogDescription>
                {open === "approve"
                  ? `${businessName} will be told straight away, and can go ahead with the work.`
                  : `${businessName} will be told. You can add a reason to help them.`}
              </DialogDescription>
            </DialogHeader>
            <FormAlert message={formError} />

            {open === "approve" ? (
              <>
                <div className="grid gap-1.5">
                  <label htmlFor={nameId} className="text-sm font-medium">
                    Your name
                  </label>
                  <Input
                    id={nameId}
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    autoComplete="name"
                    maxLength={QUOTE_DECISION_LIMITS.name}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? `${nameId}-error` : undefined}
                  />
                  {errors.name && (
                    <p id={`${nameId}-error`} className="text-sm text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={acceptId} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      id={acceptId}
                      checked={accepted}
                      onCheckedChange={(checked) => setAccepted(checked === true)}
                      aria-invalid={errors.accepted ? true : undefined}
                      aria-describedby={errors.accepted ? `${acceptId}-error` : undefined}
                      className="mt-0.5"
                    />
                    <span>I accept this quote, including its terms.</span>
                  </label>
                  {errors.accepted && (
                    <p id={`${acceptId}-error`} className="text-sm text-destructive">
                      {errors.accepted}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid gap-1.5">
                <label htmlFor={reasonId} className="text-sm font-medium">
                  Reason <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id={reasonId}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={QUOTE_DECISION_LIMITS.reason}
                  aria-invalid={errors.reason ? true : undefined}
                />
                {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
              </div>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Not now</DialogClose>
              <Button
                type="submit"
                variant="default"
                pending={pending}
                pendingLabel={open === "approve" ? "Approving…" : "Declining…"}
              >
                {open === "approve" ? "Approve quote" : "Decline quote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
