import { cn } from "@/lib/utils";

/**
 * The page loader: a small card, centred, with a stamping station: blank
 * sheets wait on the left, one rides the belt under the Stamp, gets its
 * check, and joins the stamped pile on the right; TAVI's wordmark sits below
 * (DESIGN.md → Loading). It is centred in the window,
 * except beside the desktop sidebar: the app shell sets `--page-loader-inset`
 * (the sidebar's width) from `lg` up, so there it sits in the centre of the main
 * panel. On tablet and phone, which have no sidebar, it is the screen's centre.
 *
 * It sits ON TOP of a page's skeleton and never replaces it: the skeleton
 * keeps its layout, its pulse and its screen-reader label, and this is
 * `pointer-events-none`, so nothing under it stops working. It waits 150ms
 * before it fades in, so a quick navigation never flashes it.
 *
 * Pure CSS (`.page-loader` in globals.css), no client JS. The still state
 * (what reduced motion shows) is the finished picture: the happy Stamp over
 * a stamped sheet, and TAVI.
 *
 * The figure is the mascot drawn as in brand-mascot.tsx (ink, paper and pad in
 * the light theme's colours in every theme), reduced to the four faces the
 * loop needs; the wordmark is Wordmark's own letters and V.
 */
const INK = "var(--foreground)";
const PAPER = "var(--card)";
const STAMP = "var(--stamp)";
const BODY = "var(--mascot-body, var(--foreground))";

const stroke = (d: string, w = 1.9) => <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" />;
const Eyes = ({ y = 23 }: { y?: number }) => (
  <>
    <ellipse cx={25.5} cy={y} rx={2.1} ry={2.9} fill={INK} />
    <ellipse cx={38.5} cy={y} rx={2.1} ry={2.9} fill={INK} />
  </>
);

const SHEET = "var(--surface-sunken)";
const LINE = "var(--border)";

/** One sheet of paper at x (its left edge), top y=74: a name bar and an amount bar. `stamped` adds the imprint. */
function Sheet({ x, stamped = false, animatedImprint = false }: { x: number; stamped?: boolean; animatedImprint?: boolean }) {
  const cx = x + 22;
  return (
    <>
      <rect x={x} y={74} width={44} height={32} rx={3.5} fill={SHEET} />
      <rect x={x + 6} y={96} width={22} height={3} rx={1.5} fill={LINE} />
      <rect x={x + 6} y={101} width={32} height={3} rx={1.5} fill={LINE} />
      {stamped && (
        <g className={animatedImprint ? "pl-imp-pop" : undefined}>
          <rect x={cx - 14} y={77.5} width={28} height={15} rx={3} className="fill-primary" />
          <path
            className={cn("stroke-primary-foreground", animatedImprint && "pl-check")}
            d={`M${cx - 4} 85.6 L${cx - 0.9} 89 L${cx + 5.9} 81`}
            pathLength={1}
            fill="none"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </>
  );
}

/** Two more sheets peeking above the top one: a pile. */
function Pile({ x }: { x: number }) {
  return (
    <>
      <rect x={x} y={68} width={44} height={32} rx={3.5} fill={SHEET} opacity={0.4} />
      <rect x={x} y={71} width={44} height={32} rx={3.5} fill={SHEET} opacity={0.7} />
    </>
  );
}

export function PageLoader({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "page-loader pointer-events-none fixed inset-y-0 right-0 left-[var(--page-loader-inset,0px)] z-30 grid place-items-center",
        className,
      )}
    >
      <div className="page-loader-card flex w-40 flex-col items-center gap-2 px-3 pt-1.5 pb-3.5">
        <svg viewBox="-42 -18 148 128" width={121} height={105} focusable="false" className="overflow-visible">
          {/* The belt, its ticks sliding right. */}
          <path className="pl-belt" d="M-40 108.6 H104" fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="2 6" />
          {/* In-tray (blank) and out-tray (stamped). */}
          <Pile x={-40} />
          <Sheet x={-40} />
          <Pile x={60} />
          <Sheet x={60} stamped />
          {/* The sheet that travels: in-tray → under the Stamp → out-tray. */}
          <g className="pl-sheet">
            <Sheet x={-40} stamped animatedImprint />
          </g>
          <g data-theme="light" className="dark:[--mascot-body:oklch(0.5_0.04_268)]">
            <g className="pl-mascot">
              <rect x={10} y={66} width={44} height={5} rx={2.2} fill={STAMP} />
              <path d="M26 38 H38 L40 46 H24 Z" fill={BODY} />
              <rect x={8} y={44} width={48} height={23} rx={6.5} fill={BODY} />
              <path d="M15 51 H27" stroke={PAPER} strokeWidth={2.2} strokeLinecap="round" opacity={0.28} />
              <path
                d="M12 25 C12 12 20 5 32 5 C44 5 52 12 52 25 C52 33 47 38.5 40 38.5 H24 C17 38.5 12 33 12 25 Z"
                fill={PAPER}
                stroke={INK}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <path d="M30.8 5.4 C29.4 1.6 34 0.6 35.2 3.4" fill="none" stroke={BODY} strokeWidth={2.2} strokeLinecap="round" />
              <g className="pl-face pl-f-neutral">
                <Eyes />
                {stroke("M21.5 17.4 Q25.5 15.8 29.5 17.2")}
                {stroke("M34.5 17.2 Q38.5 15.8 42.5 17.4")}
                {stroke("M28.4 30.8 Q32 33.4 35.6 30.8", 2)}
              </g>
              <g className="pl-face pl-f-focus">
                <Eyes y={24.2} />
                {stroke("M21.5 18.2 L29.5 16.6")}
                {stroke("M42.5 18.2 L34.5 16.6")}
                {stroke("M29.4 31.4 H34.6", 2)}
              </g>
              <g className="pl-face pl-f-effort">
                {stroke("M22.5 24.2 Q25.5 26.4 28.5 24.2", 2.1)}
                {stroke("M35.5 24.2 Q38.5 26.4 41.5 24.2", 2.1)}
                {stroke("M21.5 18.6 L29.5 16.8")}
                {stroke("M42.5 18.6 L34.5 16.8")}
                {stroke("M28.6 31.6 Q32 30 35.4 31.6", 2.1)}
              </g>
              <g className="pl-face pl-f-happy">
                {stroke("M22.3 24.2 Q25.5 20.4 28.7 24.2", 2.1)}
                {stroke("M35.3 24.2 Q38.5 20.4 41.7 24.2", 2.1)}
                {stroke("M21.5 17 Q25.5 15 29.5 16.6")}
                {stroke("M34.5 16.6 Q38.5 15 42.5 17")}
                {stroke("M27.6 30.8 Q32 34.6 36.4 30.8", 2.1)}
              </g>
            </g>
          </g>
        </svg>
        <span className="inline-flex items-end text-[15px] leading-none font-bold tracking-[-0.02em] text-foreground select-none">
          <span className="pl-mask">
            <span className="pl-rise" style={{ "--pl-delay": "0ms" } as React.CSSProperties}>
              TA
            </span>
          </span>
          <span className="pl-mask" style={{ width: "0.8em", height: "0.8em", marginInline: "0.01em", marginBottom: "0.005em" }}>
            <svg viewBox="0 0 24 24" className="pl-rise pl-v-box text-stamp" style={{ "--pl-delay": "100ms" } as React.CSSProperties} focusable="false">
              <path d="M2.5 9.5 L9.5 22 L22 1.5" fill="none" stroke="currentColor" strokeWidth={4.2} strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
          </span>
          <span className="pl-mask">
            <span className="pl-rise" style={{ "--pl-delay": "133ms" } as React.CSSProperties}>
              I
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
