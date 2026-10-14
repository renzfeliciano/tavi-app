"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
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
import { TRASH_RETENTION_DAYS } from "@/modules/trash/client";

/**
 * The owner's Delete on a sent quotation, a voided payment or a voided 2307: it asks first, moves the record to the
 * recycle bin, says so with a way to open the bin, and leaves the page the record no longer has.
 */
export function DeleteRecordButton({
  name,
  description,
  remove,
  redirectTo,
}: {
  /** e.g. "Quotation QUO-000012". */
  name: string;
  /** What deleting does beyond moving it to the bin (a closed link, a lost scan). */
  description: string;
  remove: () => Promise<{ ok: true } | { ok: false; error: string }>;
  redirectTo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await remove();
      setOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${name} moved to the recycle bin.`, {
        description: `It's kept for ${TRASH_RETENTION_DAYS} days, in case you need it back.`,
        action: { label: "View", onClick: () => router.push("/recycle-bin" as Route) },
      });
      router.push(redirectTo as Route);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden="true" />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent mascot="concerned" tone="danger">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              {description} It moves to the recycle bin, where you can restore it for {TRASH_RETENTION_DAYS} days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
            <Button type="button" variant="destructive" pending={pending} pendingLabel="Deleting…" onClick={confirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
