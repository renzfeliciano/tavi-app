import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  /** Cap height driver in px; the mark scales from it. */
  size?: number;
  className?: string;
};

/**
 * The TAVI wordmark: set in Geist Bold, with the V drawn as an asymmetric
 * check mark in stamp violet (approved / paid share one glyph).
 */
export function Wordmark({ size = 20, className }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label={brand.wordmark}
      className={cn(
        "inline-flex items-end font-bold tracking-[-0.02em] text-foreground select-none",
        className,
      )}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      <span aria-hidden>TA</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="text-stamp"
        style={{
          width: size * 0.8,
          height: size * 0.8,
          marginInline: size * 0.01,
          marginBottom: size * 0.005,
        }}
      >
        <path
          d="M2.5 9.5 L9.5 22 L22 1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={4.2}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      <span aria-hidden>I</span>
    </span>
  );
}
