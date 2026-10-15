import { CirclePauseIcon, RepeatIcon, SquareIcon } from "lucide-react";
import { TONE_CLASSES } from "@/components/status/status-badge";
import type { StatusTone } from "@/components/status/presentation";
import { cn } from "@/lib/utils";

export const SCHEDULE_STATUS = {
  active: { label: "Repeating", description: "A draft is made on each due date.", tone: "success", icon: RepeatIcon },
  paused: { label: "Paused", description: "No drafts are made until it is resumed.", tone: "warning", icon: CirclePauseIcon },
  ended: { label: "Ended", description: "It has made its last statement.", tone: "muted", icon: SquareIcon },
} as const satisfies Record<string, { label: string; description: string; tone: StatusTone; icon: typeof RepeatIcon }>;

export type ScheduleStatusKey = keyof typeof SCHEDULE_STATUS;

/** A schedule's standing as icon + label, like a document's status. Colour is never the only signal. */
export function ScheduleStatusBadge({ status, className }: { status: ScheduleStatusKey; className?: string }) {
  const presentation = SCHEDULE_STATUS[status];
  const Icon = presentation.icon;
  return (
    <span
      title={presentation.description}
      data-tone={presentation.tone}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[presentation.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {presentation.label}
    </span>
  );
}
