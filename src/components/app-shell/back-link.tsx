import type { Route } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

/** The way up from a detail or sub-page, above its header ("‹ Customers"). */
export function BackLink({ href, children }: { href: Route; children: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground pointer-coarse:py-3"
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
