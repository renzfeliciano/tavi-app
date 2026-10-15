"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deletePurchaseOrderDraftAction } from "../actions";

/** Deleting a draft asks first; a draft has no number yet, so nothing is left behind. */
export function DeleteDraftDialog({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await deletePurchaseOrderDraftAction(orderId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Draft deleted.");
    setOpen(false);
    router.push("/purchase-orders" as Route);
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Delete draft
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && setOpen(false)}>
        <DialogContent mascot="concerned" tone="danger">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>It will be removed for good. You can&apos;t undo this.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
            <Button type="button" variant="destructive" pending={pending} pendingLabel="Deleting…" onClick={() => void confirm()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
