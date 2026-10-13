"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Names an icon-only control on hover and on keyboard focus. Applies only while
 * the sidebar is collapsed: expanded, the label is already on screen, so the
 * tooltip is switched off.
 *
 * The wrapper is always rendered, only disabled, so the child stays the same
 * element whether or not the tip is active. A child that opens a menu or popup
 * positions it against that element: swapping the wrapper in and out would
 * rebuild the child, and the popup would be left anchored to a detached node.
 */
export function CollapsedTip({
  label,
  active,
  children,
}: {
  label: ReactNode;
  active: boolean;
  children: ReactElement;
}) {
  return (
    <Tooltip disabled={!active}>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
