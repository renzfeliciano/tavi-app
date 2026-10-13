import type { ReactNode } from "react";

/**
 * Columns at the `sm` breakpoint for a row of figures: as many as there are
 * figures up to three, and two for four. Written out in full so Tailwind finds
 * every class.
 */
const COLUMNS = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
} as const;

const SPAN = { 2: "sm:col-span-2", 3: "sm:col-span-3" } as const;

function columnsFor(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}

/**
 * A row of headline figures, as tiles divided by hairlines. The grid's
 * background is the hairline colour, so every cell must be a tile: the columns
 * follow the number of figures, and a last figure that would leave a gap
 * stretches to fill its row.
 */
export function Figures({ items, currency }: { items: { label: string; value: ReactNode }[]; currency: string | null }) {
  const columns = columnsFor(items.length);
  const leftover = items.length % columns;
  const lastSpan = leftover === 0 ? null : ((columns - leftover + 1) as 2 | 3);
  return (
    <dl className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs ${COLUMNS[columns]}`}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`bg-card px-5 py-4 ${index === items.length - 1 && lastSpan ? SPAN[lastSpan] : ""}`.trim()}
        >
          <dt className="text-sm text-muted-foreground">
            {item.label}
            {currency ? ` (${currency})` : ""}
          </dt>
          <dd className="mt-1 text-2xl font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A multiple to one decimal place, without a trailing ".0": 2.4, 3. */
const times = (ratio: number) => Number(ratio.toFixed(1));

/**
 * How this period's total compares with the one before, in words. Quiet when
 * there's nothing to compare. A percentage reads well up to double; beyond that
 * it says how many times as much, and past ten times just says so, because a
 * four-digit percentage on a small base is noise.
 */
export function Compared({
  now,
  before,
  format,
  label,
}: {
  now: number;
  before: number;
  format: (minor: number) => ReactNode;
  label: string;
}) {
  if (before === 0 && now === 0) return null;
  if (before === 0) return <p className="text-sm text-muted-foreground">Nothing in {label} to compare with.</p>;
  const change = now - before;
  const ratio = now / before;
  return (
    <p className="text-sm text-muted-foreground">
      {change === 0 ? (
        <>Same as {label}: {format(before)}.</>
      ) : ratio >= 10 ? (
        <>More than ten times {label}: {format(before)} then.</>
      ) : ratio >= 2 ? (
        <>{times(ratio)} times {label}: {format(before)} then.</>
      ) : (
        <>
          {change > 0 ? "Up" : "Down"} {Math.round((Math.abs(change) / before) * 100)}% from {label}: {format(before)} then.
        </>
      )}
    </p>
  );
}
