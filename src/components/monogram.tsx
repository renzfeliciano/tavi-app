import { cn } from "@/lib/utils";

const firstLetter = (word: string | undefined) =>
  word === undefined ? "" : (new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)[Symbol.iterator]().next().value?.segment ?? "");

/** "Juan Dela Cruz" → "JC", "Santos" → "S": the first letters of the first and last words. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = firstLetter(parts[0]) + (parts.length > 1 ? firstLetter(parts.at(-1)) : "");
  return letters.toUpperCase() || "?";
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

/**
 * A person's or business's initials on a small ink-on-paper disc, for the front of a row or a record's header.
 * Decoration only: the name is always written beside it.
 */
export function Monogram({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-border bg-surface-sunken font-semibold text-ink-subtle select-none",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
