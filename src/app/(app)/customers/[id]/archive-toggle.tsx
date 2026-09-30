"use client";

import { useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveCustomerAction, restoreCustomerAction } from "../actions";

/**
 * Archive is reversible, so it asks no confirmation (§33): the toast offers
 * Undo instead.
 */
export function ArchiveToggle({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  function run(archive: boolean) {
    startTransition(async () => {
      const result = archive ? await archiveCustomerAction(id) : await restoreCustomerAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (archive) {
        toast.success(`${name} archived.`, {
          description: "Hidden from your customer list and pickers.",
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
