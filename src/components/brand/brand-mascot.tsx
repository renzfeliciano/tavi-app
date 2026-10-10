"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * "The Stamp", TAVI's mascot (docs/foundation-proposal.md §P, decisions D3
 * and D20). A rubber stamp with a face: a white head on an ink body, an inked
 * violet pad and, for good news, the wordmark's check-mark V as its imprint.
 *
 * Rules (DESIGN.md → Mascot): decorative by default and never the only
 * carrier of meaning. Idle life is small (a blink, a slow breath, eyes that
 * follow the pointer); the large moment (press + imprint) plays once and only
 * on request. `prefers-reduced-motion` gets the still drawing.
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

/** Below this height the pupils are too small to follow anything. */
const FOLLOW_MIN_HEIGHT = 32;

type BrandMascotProps = {
  expression?: MascotExpression;
  size?: MascotSize;
  /** Play the press-and-imprint moment once on mount. */
  animated?: boolean;
  /** Blink and breathe while idle (default). Pass `false` to hold it still. */
  idle?: boolean;
  /** Eyes follow the pointer (default). Quiet screens, like sign-in, turn it off. */
  follow?: boolean;
  /** Skip the occasional stamp press: breathing, blinking and a slight head turn only. */
  calm?: boolean;
  /** When set, the mascot is announced as an image with this name. */
  label?: string;
  className?: string;
};

const INK = "var(--foreground)";
const STAMP = "var(--stamp)";
const PAPER = "var(--card)";

const line = { fill: "none", stroke: INK, strokeLinecap: "round" as const };

/** Eyes sit at (25.5, 23) and (38.5, 23); brows at y 17.5; the mouth at y 31. */
function Pupil({ x, y = 23, rx = 2.1, ry = 2.9 }: { x: number; y?: number; rx?: number; ry?: number }) {
  return (
    <g className="mascot-pupil">
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} />
    </g>
  );
}

const Brow = ({ d }: { d: string }) => <path d={d} {...line} strokeWidth={1.9} />;
const ArcUp = ({ x }: { x: number }) => <path d={`M${x - 3.2} 24.2 Q${x} 20.4 ${x + 3.2} 24.2`} {...line} strokeWidth={2.1} />;
const ArcDown = ({ x }: { x: number }) => <path d={`M${x - 3} 22.6 Q${x} 25.6 ${x + 3} 22.6`} {...line} strokeWidth={2} />;

function Face({ expression }: { expression: MascotExpression }) {
  switch (expression) {
    case "happy":
    case "celebrating":
      return (
        <>
          <ArcUp x={25.5} />
          <ArcUp x={38.5} />
          <Brow d="M21.5 17 Q25.5 15 29.5 16.6" />
          <Brow d="M34.5 16.6 Q38.5 15 42.5 17" />
          <path d={expression === "celebrating" ? "M26.8 30.4 Q32 36 37.2 30.4" : "M27.6 30.8 Q32 34.6 36.4 30.8"} {...line} strokeWidth={2.1} />
        </>
      );
    case "curious":
      return (
        <>
          <g className="mascot-blink">
            <Pupil x={25.5} />
            <Pupil x={38.5} ry={3.3} rx={2.4} />
          </g>
          <Brow d="M21.5 17.8 L29.5 17.2" />
          <Brow d="M34.5 14.6 Q38.5 12.4 42.5 14.8" />
          <circle cx={33.2} cy={31.6} r={1.6} fill="none" stroke={INK} strokeWidth={1.9} />
        </>
      );
    case "concerned":
      return (
        <>
          <g className="mascot-blink">
            <Pupil x={25.5} y={23.6} />
            <Pupil x={38.5} y={23.6} />
          </g>
          <Brow d="M21 18.8 L29.4 16.2" />
          <Brow d="M43 18.8 L34.6 16.2" />
          <path d="M28.6 32.2 Q32 29.4 35.4 32.2" {...line} strokeWidth={2} />
        </>
      );
    case "waiting":
      return (
        <>
          <g className="mascot-blink">
            <Pupil x={25.5} />
            <Pupil x={38.5} />
          </g>
          <Brow d="M21.5 17.4 L29.5 17.4" />
          <Brow d="M34.5 17.4 L42.5 17.4" />
          <path d="M29.2 31.2 H34.8" {...line} strokeWidth={2} />
        </>
      );
    case "resting":
      return (
        <>
          <ArcDown x={25.5} />
          <ArcDown x={38.5} />
          <Brow d="M21.5 18.4 Q25.5 17.4 29.5 18.4" />
          <Brow d="M34.5 18.4 Q38.5 17.4 42.5 18.4" />
          <path d="M29.8 31.2 Q32 32.4 34.2 31.2" {...line} strokeWidth={1.9} />
        </>
      );
    case "neutral":
      return (
        <>
          <g className="mascot-blink">
            <Pupil x={25.5} />
            <Pupil x={38.5} />
          </g>
          <Brow d="M21.5 17.4 Q25.5 15.8 29.5 17.2" />
          <Brow d="M34.5 17.2 Q38.5 15.8 42.5 17.4" />
          <path d="M28.4 30.8 Q32 33.4 35.6 30.8" {...line} strokeWidth={2} />
        </>
      );
  }
}

const TILT: Partial<Record<MascotExpression, number>> = {
  curious: -6,
  concerned: 3,
  resting: 3,
};

const SHOWS_IMPRINT: ReadonlySet<MascotExpression> = new Set(["happy", "celebrating"]);

/** Eyes that look at the pointer: one shared listener per mascot, only when motion is welcome. */
function useLookAtPointer(ref: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  useEffect(() => {
    const svg = ref.current;
    if (!enabled || !svg) return;
    // Environments without matchMedia (tests) have no preference to honour.
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!svg) return;
        const box = svg.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.27);
        const distance = Math.hypot(dx, dy) || 1;
        const strength = Math.min(1, distance / 220);
        svg.style.setProperty("--look-x", ((dx / distance) * strength * 1.9).toFixed(2));
        svg.style.setProperty("--look-y", ((dy / distance) * strength * 1.4).toFixed(2));
        svg.style.setProperty("--look-tilt", ((dx / distance) * strength * 3).toFixed(2));
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [ref, enabled]);
}

export function BrandMascot({
  expression = "neutral",
  size = "md",
  animated = false,
  idle = true,
  follow: followPointer = true,
  calm = false,
  label,
  className,
}: BrandMascotProps) {
  const height = SIZES[size];
  const tilt = TILT[expression] ?? 0;
  const decorative = label === undefined;
  const ref = useRef<SVGSVGElement>(null);
  const follows = followPointer && idle && height >= FOLLOW_MIN_HEIGHT && expression !== "resting";
  useLookAtPointer(ref, follows);

  return (
    <svg
      ref={ref}
      viewBox="-2 0 72 88"
      width={height * (72 / 88)}
      height={height}
      className={cn("mascot shrink-0 overflow-visible", className)}
      data-expression={expression}
      data-animated={animated ? "true" : undefined}
      data-idle={idle ? "true" : undefined}
      data-calm={calm ? "true" : undefined}
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <g className={cn(animated && "motion-safe:animate-stamp-press")} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        <g className={cn(idle && "mascot-breathe")}>
          {/* Pad, mount and base: the stamp itself. */}
          <rect x={10} y={66} width={44} height={5} rx={2.2} fill={STAMP} />
          <path d="M26 38 H38 L40 46 H24 Z" fill={INK} />
          <rect x={8} y={44} width={48} height={23} rx={6.5} fill={INK} />
          <path d="M15 51 H27" stroke={PAPER} strokeWidth={2.2} strokeLinecap="round" opacity={0.28} />
          {/* The handle is the head; it turns toward the pointer while the base stays planted. */}
          <g className="mascot-head">
            <path d="M12 25 C12 12 20 5 32 5 C44 5 52 12 52 25 C52 33 47 38.5 40 38.5 H24 C17 38.5 12 33 12 25 Z" fill={PAPER} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            <path d="M30.8 5.4 C29.4 1.6 34 0.6 35.2 3.4" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
            <Face expression={expression} />
          </g>
        </g>
      </g>

      {SHOWS_IMPRINT.has(expression) && (
        <path
          d="M23.5 79 L29.6 85.4 L42 73.6"
          fill="none"
          stroke={STAMP}
          strokeWidth={3.4}
          strokeLinecap="square"
          strokeLinejoin="miter"
          className={cn(animated && "motion-safe:animate-imprint-in")}
          style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        />
      )}

      {expression === "concerned" && (
        <path d="M50.5 11 C48.4 14 47.6 15.4 47.6 16.9 C47.6 18.7 48.9 19.9 50.5 19.9 C52.1 19.9 53.4 18.7 53.4 16.9 C53.4 15.4 52.6 14 50.5 11 Z" fill={STAMP} opacity={0.9} />
      )}

      {expression === "waiting" && (
        <g fill={STAMP} className="mascot-dots">
          <circle cx={58} cy={9} r={1.7} />
          <circle cx={62.6} cy={9} r={1.7} />
          <circle cx={67.2} cy={9} r={1.7} />
        </g>
      )}

      {expression === "resting" && (
        <g fill="none" stroke={STAMP} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 8 h5 l-5 6 h5" />
          <path d="M61.5 1 h3.4 l-3.4 4.2 h3.4" opacity={0.7} />
        </g>
      )}

      {expression === "celebrating" && (
        <g stroke={STAMP} strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
          <path d="M5 30 L1 25.5" />
          <path d="M3.5 38 H-1.5" />
          <path d="M59 30 L63 25.5" />
          <path d="M60.5 38 H65.5" />
        </g>
      )}
    </svg>
  );
}
