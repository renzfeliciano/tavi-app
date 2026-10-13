import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Figure = {
  key: string;
  label: string;
  /** The amount or count: a `MoneyAmount` for money. */
  value: ReactNode;
  /** What it is made of, in a few words ("3 billing statements"). */
  detail?: string;
  /** Danger ink, only for something that needs doing now (money past due). */
  tone?: "danger";
  /** Where the figure's list lives; without one the figure is plain text. */
  href?: Route;
  /** `false` leaves it out on a phone, which has room for two figures in a row. */
  phone?: boolean;
};

export type StripRow = { key: string; figures: Figure[] };

const COLUMNS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;

// Shared with the strip's skeleton (`SummaryStripSkeleton`), so the two never drift apart.
export const STRIP_SECTION = "mt-8 grid gap-3";
export const stripRowClass = (onPhone: number, figures: number) =>
  cn(
    "grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs",
    onPhone > 1 ? "grid-cols-2" : "grid-cols-1",
    COLUMNS[Math.min(figures, 3) as 1 | 2 | 3],
  );
export const STRIP_TILE = "px-3 py-2.5 sm:px-4 sm:py-3";

const tile = cn("block h-full", STRIP_TILE);
const link =
  "outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35";

/**
 * A few figures over a list: what the list adds up to, one row per currency (never summed across currencies).
 * One row of tiles, so it takes the same room at every width and the table under it can be sized to fit; a phone
 * shows two figures and leaves out any marked `phone: false`. Figures are counts and amounts only, never animated.
 */
export function SummaryStrip({ label, rows }: { label: string; rows: readonly StripRow[] }) {
  const shown = rows.filter((row) => row.figures.length > 0);
  if (shown.length === 0) return null;
  return (
    <section aria-label={label} className={STRIP_SECTION}>
      {shown.map((row) => {
        const onPhone = row.figures.filter((figure) => figure.phone !== false).length;
        return (
          <ul key={row.key} className={stripRowClass(onPhone, row.figures.length)}>
            {row.figures.map((figure) => {
              const content = (
                <>
                  <span className="block text-xs text-muted-foreground">{figure.label}</span>
                  <span className={cn("mt-0.5 block text-lg font-semibold", figure.tone === "danger" && "text-danger-strong")}>
                    {figure.value}
                  </span>
                  {figure.detail && <span className="block text-xs text-muted-foreground">{figure.detail}</span>}
                </>
              );
              return (
                <li key={figure.key} className={cn("bg-card", figure.phone === false && "max-sm:hidden")}>
                  {figure.href ? (
                    <Link href={figure.href} className={cn(tile, link)}>
                      {content}
                    </Link>
                  ) : (
                    <div className={tile}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        );
      })}
    </section>
  );
}
