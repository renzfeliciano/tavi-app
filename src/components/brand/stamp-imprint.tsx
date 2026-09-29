import { cn } from "@/lib/utils";

type StampImprintProps = {
  /** e.g. "Approved", "Paid". Shown uppercase, like a real rubber stamp. */
  label: string;
  /** Pre-formatted date line, e.g. "30 Sep 2026". */
  date?: string;
  animated?: boolean;
  className?: string;
};

/**
 * The inked imprint the Stamp leaves on a document. Purely decorative: the
 * status is always also stated in text (StatusBadge), so this is aria-hidden.
 */
export function StampImprint({
  label,
  date,
  animated = false,
  className,
}: StampImprintProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "inline-grid -rotate-6 justify-items-center rounded-md border-2 border-stamp px-2.5 py-1 font-mono text-stamp opacity-90 select-none",
        animated && "motion-safe:animate-imprint-in",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold tracking-[0.18em] uppercase">
        {label}
        <svg viewBox="0 0 24 24" className="size-3.5">
          <path
            d="M2.5 11 L9.5 21 L22 3"
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="square"
          />
        </svg>
      </span>
      {date && (
        <span className="text-[10px] tracking-[0.2em] uppercase">{date}</span>
      )}
    </div>
  );
}
