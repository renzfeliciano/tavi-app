"use client";

import { type ReactNode, useState } from "react";
import { CircleCheckIcon, PencilLineIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

// The bar at the foot of a long settings form: it stays in view while the form scrolls, says whether anything is
// waiting to be saved (icon and words, never colour alone), and holds the save button. On a phone it sits above the
// tab bar; on a wide screen it floats just off the bottom edge. See DESIGN.md, "Settings forms".

/**
 * Whether the person has edited the form since the page last answered. Spread `formProps` on the `<form>`: change and
 * input events bubble up from every field. `resetKey` is whatever changes when the server answers (the form state's
 * `submission`), which makes the form clean again without an effect.
 */
export function useFormDirty(resetKey: unknown) {
  const [editedAt, setEditedAt] = useState<{ key: unknown } | null>(null);
  const mark = () => setEditedAt({ key: resetKey });
  return {
    dirty: editedAt !== null && Object.is(editedAt.key, resetKey),
    formProps: { onChange: mark, onInput: mark },
  };
}

export function SaveBar({
  dirty,
  saved,
  pending,
  label = "Save changes",
  pendingLabel = "Saving…",
  form,
  className,
  children,
}: {
  /** Edited since the last answer from the server. */
  dirty: boolean;
  /** The server has saved this form, and nothing has changed since. */
  saved: boolean;
  pending: boolean;
  label?: string;
  pendingLabel?: string;
  /**
   * The id of the form this saves, when the bar sits beside the form rather than inside it. A sticky bar can only
   * stay in view while its parent does, so on a long page it belongs in the page's column, not in the form's box.
   */
  form?: string;
  className?: string;
  /** Other actions that belong beside the save button. */
  children?: ReactNode;
}) {
  const Icon = dirty ? PencilLineIcon : CircleCheckIcon;
  const text = dirty ? "Unsaved changes" : saved ? "All changes saved" : "No changes yet";
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm lg:bottom-4",
        className,
      )}
    >
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
        {text}
      </p>
      <div className="flex items-center gap-2">
        {children}
        <Button type="submit" form={form} pending={pending} pendingLabel={pendingLabel}>
          {label}
        </Button>
      </div>
    </div>
  );
}
