import { CircleCheckIcon, HourglassIcon } from "lucide-react";
import { TONE_CLASSES } from "@/components/status/status-badge";
import { cn } from "@/lib/utils";
import type { WithholdingStatus } from "@/modules/payments/client";

const PRESENTATION = {
  pending: {
    label: "pending",
    description: "The customer withheld tax and hasn't sent the 2307 yet.",
    tone: "warning",
    icon: HourglassIcon,
  },
  received: {
    label: "received",
    description: "The 2307 for this payment is recorded.",
    tone: "success",
    icon: CircleCheckIcon,
  },
} as const;

/**
 * Where a payment stands on its withholding certificate: "2307 pending" or "2307 received" (nothing when no tax was
 * withheld). Icon and words, never colour alone. `certificate` is the form's short name from the market profile.
 * `compact` is for a line of small type: 1.25rem tall, like the tags in Settings, so the line keeps its height.
 */
export function WithholdingBadge({
  status,
  certificate,
  compact = false,
  className,
}: {
  status: WithholdingStatus;
  certificate: string;
  compact?: boolean;
  className?: string;
}) {
  if (status === "none") return null;
  const presentation = PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <span
      title={presentation.description}
      data-tone={presentation.tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        compact ? "h-5" : "h-6",
        TONE_CLASSES[presentation.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {certificate} {presentation.label}
    </span>
  );
}
