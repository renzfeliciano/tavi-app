"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
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

type Command = { ok: true } | { ok: false; error: string };
type RestoreResult = { ok: true; href: string | null; note: string | null } | { ok: false; error: string };

type DiscardDialogProps = {
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<void>;
  triggerVariant?: "ghost" | "outline";
};

/** Deleting for good can't be undone, so it asks first (§33). */
function DiscardDialog({ trigger, title, description, confirmLabel, pendingLabel, onConfirm, triggerVariant = "ghost" }: DiscardDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant={triggerVariant} onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden="true" />
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent mascot="concerned" tone="danger">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
            <Button
              type="button"
              variant="destructive"
              pending={pending}
              pendingLabel={pendingLabel}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type TrashRowActionsProps = {
  /** Shown in the toasts, e.g. "Billing statement draft for Juan Dela Cruz". */
  name: string;
  /** Server actions, already bound to the item. `discard` is null when this person can't delete for good. */
  restore: () => Promise<RestoreResult>;
  discard: (() => Promise<Command>) | null;
};

/** Restore (anyone who can write the document) and Delete forever (owners and admins). */
export function TrashRowActions({ name, restore, discard }: TrashRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await restore();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const href = result.href;
      toast.success(`${name} restored.`, {
        description: result.note ?? undefined,
        action: href ? { label: "Open", onClick: () => router.push(href as Route) } : undefined,
      });
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" pending={pending} pendingLabel="Restoring…" onClick={run}>
        <ArchiveRestoreIcon aria-hidden="true" />
        Restore
      </Button>
      {discard && (
        <DiscardDialog
          trigger="Delete forever"
          title="Delete this draft forever?"
          description={`${name} can't be brought back after this.`}
          confirmLabel="Delete forever"
          pendingLabel="Deleting…"
          onConfirm={async () => {
            const result = await discard();
            if (result.ok) toast.success(`${name} deleted for good.`);
            else toast.error(result.error);
          }}
        />
      )}
    </div>
  );
}

/** Owners and admins: remove everything in the bin at once. */
export function EmptyBinButton({ count, empty }: { count: number; empty: () => Promise<{ ok: true; removed: number } | { ok: false; error: string }> }) {
  return (
    <DiscardDialog
      triggerVariant="outline"
      trigger="Empty recycle bin"
      title="Empty the recycle bin?"
      description={`${count} deleted ${count === 1 ? "draft" : "drafts"} will be removed for good. This can't be undone.`}
      confirmLabel="Empty recycle bin"
      pendingLabel="Emptying…"
      onConfirm={async () => {
        const result = await empty();
        if (result.ok) toast.success("Recycle bin emptied.");
        else toast.error(result.error);
      }}
    />
  );
}

/** An archived customer, product, service or tax: one tap, and the toast says so. */
export function RestoreButton({ name, restore }: { name: string; restore: () => Promise<Command> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={`Restore ${name}`}
      pending={pending}
      pendingLabel="Restoring…"
      onClick={() =>
        startTransition(async () => {
          const result = await restore();
          if (result.ok) toast.success(`${name} restored.`);
          else toast.error(result.error);
        })
      }
    >
      <ArchiveRestoreIcon aria-hidden="true" />
      Restore
    </Button>
  );
}
