"use client";

import { useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CommandResult = { ok: true } | { ok: false; error: string };

type ArchiveToggleProps = {
  /** Shown in the toasts, e.g. "Juan Dela Cruz archived." */
  name: string;
  archived: boolean;
  /** What archiving hides, e.g. "Hidden from your customer list and pickers." */
  archivedDescription: string;
  /** Server actions, already bound to the record. */
  archive: () => Promise<CommandResult>;
  restore: () => Promise<CommandResult>;
};

/**
 * Archive is reversible, so it asks no confirmation (§33): the toast offers
 * Undo instead.
 */
export function ArchiveToggle({ name, archived, archivedDescription, archive, restore }: ArchiveToggleProps) {
  const [pending, startTransition] = useTransition();

  function run(toArchive: boolean) {
    startTransition(async () => {
      const result = toArchive ? await archive() : await restore();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (toArchive) {
        toast.success(`${name} archived.`, {
          description: archivedDescription,
          action: { label: "Undo", onClick: () => run(false) },
        });
      } else {
        toast.success(`${name} restored.`);
      }
    });
  }

  return archived ? (
    <Button variant="outline" pending={pending} pendingLabel="Restoring…" onClick={() => run(false)}>
      <ArchiveRestoreIcon aria-hidden="true" />
      Restore
    </Button>
  ) : (
    <Button variant="outline" pending={pending} pendingLabel="Archiving…" onClick={() => run(true)}>
      <ArchiveIcon aria-hidden="true" />
      Archive
    </Button>
  );
}
