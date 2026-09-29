import { cn } from "@/lib/utils";

/**
 * "The Stamp", TAVI's mascot (docs/foundation-proposal.md §P, decision D3).
 * A rubber stamp with two eyes; its imprint is the wordmark's check-mark V.
 *
 * Rules (DESIGN.md → Mascot): decorative by default and never the only
 * carrier of meaning; animates only on request, once, for real moments
 * (sent, approved, paid); `prefers-reduced-motion` gets the static pose.
 */

export const MASCOT_EXPRESSIONS = [
  "neutral",
  "happy",
  "curious",
  "concerned",
  "waiting",
  "celebrating",
  "resting",
] as const;
export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];

const SIZES = { xs: 20, sm: 32, md: 56, lg: 88, xl: 128 } as const;
export type MascotSize = keyof typeof SIZES;

type BrandMascotProps = {
  expression?: MascotExpression;
  size?: MascotSize;
  /** Play the press-and-imprint moment once on mount. */
  animated?: boolean;
  /** When set, the mascot is announced as an image with this name. */
  label?: string;
  className?: string;
};

const EYE = "var(--card)";

function Eyes({ expression }: { expression: MascotExpression }) {
  switch (expression) {
    case "happy":
    case "celebrating":
      return (
        <g fill="none" stroke={EYE} strokeWidth={2.2} strokeLinecap="round">
          <path d="M25 17.5 Q27.5 13.8 30 17.5" />
          <path d="M34 17.5 Q36.5 13.8 39 17.5" />
        </g>
      );
    case "curious":
      return (
        <g fill={EYE}>
          <circle cx={28.5} cy={14.8} r={2.2} />
          <circle cx={37.5} cy={14.6} r={2.7} />
        </g>
      );
    case "concerned":
      return (
        <g>
          <g fill="none" stroke={EYE} strokeWidth={1.6} strokeLinecap="round">
            <path d="M24.8 13.2 L29.4 11.8" />
            <path d="M39.2 13.2 L34.6 11.8" />
          </g>
          <g fill={EYE}>
            <circle cx={27.5} cy={17} r={2} />
            <circle cx={36.5} cy={17} r={2} />
          </g>
        </g>
      );
    case "waiting":
      return (
        <g fill={EYE}>
          <circle cx={29.5} cy={16} r={2.2} />
          <circle cx={38.5} cy={16} r={2.2} />
        </g>
      );
    case "resting":
      return (
        <g fill="none" stroke={EYE} strokeWidth={2} strokeLinecap="round">
          <path d="M25.2 16.6 H29.8" />
          <path d="M34.2 16.6 H38.8" />
        </g>
      );
    case "neutral":
      return (
        <g fill={EYE}>
          <circle cx={27.5} cy={16} r={2.3} />
          <circle cx={36.5} cy={16} r={2.3} />
        </g>
      );
  }
}

const TILT: Partial<Record<MascotExpression, number>> = {
  curious: -9,
  concerned: 6,
};

const SHOWS_IMPRINT: ReadonlySet<MascotExpression> = new Set([
  "happy",
  "celebrating",
]);

export function BrandMascot({
  expression = "neutral",
  size = "md",
  animated = false,
  label,
  className,
}: BrandMascotProps) {
  const height = SIZES[size];
  const tilt = TILT[expression] ?? 0;
  const decorative = label === undefined;

  return (
    <svg
      viewBox="0 0 64 80"
      width={height * 0.8}
      height={height}
      className={cn("shrink-0 overflow-visible", className)}
      data-expression={expression}
      data-animated={animated ? "true" : undefined}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    >
      <g>
        <g
          className={cn(animated && "motion-safe:animate-stamp-press")}
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        >
          {/* Handle knob (the head). Only the head tilts; the base stays planted. */}
          <g transform={tilt ? `rotate(${tilt} 32 28)` : undefined}>
            <circle cx={32} cy={16} r={12} fill="var(--foreground)" />
            <Eyes expression={expression} />
          </g>
          {/* Neck and mount */}
          <path d="M26.5 26.5 H37.5 L39.5 38 H24.5 Z" fill="var(--foreground)" />
          <rect x={12} y={38} width={40} height={14} rx={3} fill="var(--foreground)" />
          {/* Inked rubber */}
          <rect x={14} y={52} width={36} height={4} rx={1} fill="var(--stamp)" />
        </g>
      </g>

      {SHOWS_IMPRINT.has(expression) && (
        <path
          d="M22.5 64.5 L29.5 74 L43 58.5"
          fill="none"
          stroke="var(--stamp)"
          strokeWidth={3.6}
          strokeLinecap="square"
          strokeLinejoin="miter"
          className={cn(animated && "motion-safe:animate-imprint-in")}
          style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        />
      )}

      {expression === "celebrating" && (
        <g stroke="var(--stamp)" strokeWidth={2} strokeLinecap="round" opacity={0.7}>
          <path d="M7.5 41 L3.5 38" />
          <path d="M8 47 L3 47" />
          <path d="M56.5 41 L60.5 38" />
          <path d="M56 47 L61 47" />
        </g>
      )}
    </svg>
  );
}
