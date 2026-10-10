import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One row of the quote and billing statement lists. Who it's for leads, with
 * the number and date beneath; the status and amount sit at the right edge.
 * There is no fixed number column, so a draft (which has no number yet)
 * never leaves a blank gap on the left.
 */
export function DocumentRow({
  href,
  customer,
  meta,
  status,
  amount,
}: {
  href: Route;
  customer: ReactNode;
  /** Number, then date or due date, e.g. "Nº INV-000012 · Due Oct 25, 2026". */
  meta: ReactNode;
  status: ReactNode;
  amount: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:px-6"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{customer}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">{meta}</span>
      </span>
      <span className="flex flex-col items-end gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-5">
        <span className="font-medium">{amount}</span>
        {status}
      </span>
    </Link>
  );
}
