import type { Route } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

/**
 * The way up from a detail or sub-page, above its header. A real button-shaped
 * target (border, surface, arrow, "Back to Customers") rather than a faint
 * "‹ Customers" line, so it is easy to see and to hit, on a phone as well.
 */
export function BackLink({ href, children }: { href: Route; children: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-border-strong bg-card px-3 text-sm font-medium text-foreground shadow-xs transition-[background-color,transform] duration-(--duration-fast) ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[0.97] pointer-coarse:h-11"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">Back to {children}</span>
    </Link>
  );
}
