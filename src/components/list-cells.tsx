import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The main text of a row's first cell: one line, cut short rather than wrapped. */
export function CellTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block truncate font-medium", className)}>{children}</span>;
}

/** The quieter line under it (a company, a number, a date). */
export function CellSub({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block truncate text-sm text-muted-foreground", className)}>{children}</span>;
}
