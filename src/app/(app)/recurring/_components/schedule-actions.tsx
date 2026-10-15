"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CirclePauseIcon, PencilIcon, PlayIcon, SquareIcon } from "lucide-react";
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

type CommandResult = { ok: true } | { ok: false; error: string };
type Command = () => Promise<CommandResult>;

type ScheduleActionsProps = {
  id: string;
  status: "active" | "paused" | "ended";
  /** Why a paused schedule stopped by itself, in words for the person; null when they paused it. */
  pauseReason: string | null;
  /** The server actions, bound to this schedule by the page. */
  pause: Command;
  resume: Command;
  end: Command;
};

/**
 * What can be done with a schedule from where it stands (spec 4): edit, pause or end an active one; resume a
 * paused one (with the reason it paused); nothing for an ended one. Ending asks first, since it can't be undone.
 */
export function ScheduleActions({ id, status, pauseReason, pause, resume, end }: ScheduleActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pause" | "resume" | "end" | null>(null);
  const [ending, setEnding] = useState(false);

  async function run(kind: "pause" | "resume" | "end", command: Command, done: string) {
    setBusy(kind);
    const result = await command();
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEnding(false);
    toast.success(done);
    router.refresh();
  }

  if (status === "ended") return null;

  return (
    <div className="grid gap-3">
      {status === "paused" && pauseReason && <p className="text-sm text-muted-foreground">{pauseReason}</p>}
      <div className="flex flex-wrap gap-2">
        <Link href={`/recurring/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Link>
        {status === "active" ? (
          <Button
            type="button"
            variant="outline"
            pending={busy === "pause"}
            pendingLabel="Pausing…"
            onClick={() => void run("pause", pause, "Schedule paused.")}
          >
            <CirclePauseIcon aria-hidden="true" />
            Pause
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            pending={busy === "resume"}
            pendingLabel="Resuming…"
            onClick={() => void run("resume", resume, "Schedule resumed.")}
          >
            <PlayIcon aria-hidden="true" />
            Resume
          </Button>
        )}
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setEnding(true)}>
          <SquareIcon aria-hidden="true" />
          End
        </Button>
      </div>

      <Dialog open={ending} onOpenChange={(next) => busy !== "end" && setEnding(next)}>
        <DialogContent mascot="concerned" tone="danger">
          <DialogHeader>
            <DialogTitle>End this schedule?</DialogTitle>
            <DialogDescription>No more statements will be prepared. The ones already made stay.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={busy === "end"} />}>Keep it</DialogClose>
            <Button
              type="button"
              variant="destructive"
              pending={busy === "end"}
              pendingLabel="Ending…"
              onClick={() => void run("end", end, "Schedule ended.")}
            >
              End schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
