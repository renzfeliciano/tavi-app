"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Names an icon-only control on hover and on keyboard focus. Applies only while
 * the sidebar is collapsed: expanded, the label is already on screen, so the
 * child is returned untouched.
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
  if (!active) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
