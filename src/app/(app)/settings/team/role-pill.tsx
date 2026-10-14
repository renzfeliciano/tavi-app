import { CrownIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { ROLE_LABELS } from "@/modules/organizations/client";
import { cn } from "@/lib/utils";

type Role = keyof typeof ROLE_LABELS;

const ICONS = { owner: CrownIcon, admin: ShieldCheckIcon, member: UserRoundIcon } as const;

/** A person's role as a small pill: an icon and the word. The owner's is inked a step darker than the others. */
export function RolePill({ role, className }: { role: Role; className?: string }) {
  const Icon = ICONS[role];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        role === "owner" ? "border-border-strong bg-surface-sunken text-foreground" : "border-border text-ink-subtle",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {ROLE_LABELS[role]}
    </span>
  );
}
