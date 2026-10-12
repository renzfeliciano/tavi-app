import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Keeps what's inside in the light theme even when the app is dark (D24): the
 * customer's pages (their sender's document is paper, like the PDF they can
 * download), and anything else that must look the same for everyone. It works
 * because [data-theme="light"] re-declares every colour token (globals.css).
 * It paints its own ground and grows to fill the page.
 */
export function LightScope({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-theme="light" className={cn("flex-1 bg-background text-foreground", className)}>
      {children}
    </div>
  );
}
