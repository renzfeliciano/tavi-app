import { cn } from "@/lib/utils";

/**
 * The theme icon (option C): in light a sun whose core is the logo's violet
 * disc with the white check; in dark a moon with the same check beside it.
 * Both are drawn; the theme (explicit or the browser's) shows one, in CSS only.
 */
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const at = (r: number) => [(24 + Math.cos(a) * r).toFixed(2), (24 + Math.sin(a) * r).toFixed(2)] as const;
  const [x1, y1] = at(13);
  const [x2, y2] = at(17.5);
  return { x1, y1, x2, y2 };
});

const CHECK = "M4 12.5 L9.5 18 L20 6.5";

export function ThemeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-6 shrink-0 text-foreground", className)}>
      <g className="dark:hidden">
        {RAYS.map((r, i) => (
          <line key={i} {...r} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        ))}
        <circle cx={24} cy={24} r={9} className="fill-primary" />
        <path
          transform="translate(24 24) scale(0.62) translate(-12 -12)"
          d={CHECK}
          fill="none"
          className="stroke-primary-foreground"
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="hidden dark:block">
        <mask id="theme-moon">
          <rect width={48} height={48} fill="#fff" />
          <circle cx={31} cy={18} r={10.5} fill="#000" />
        </mask>
        <circle cx={23} cy={25} r={13} fill="currentColor" mask="url(#theme-moon)" />
        <circle cx={31} cy={31} r={8} className="fill-primary stroke-background" strokeWidth={2} />
        <path
          transform="translate(31 31) scale(0.55) translate(-12 -12)"
          d={CHECK}
          fill="none"
          className="stroke-primary-foreground"
          strokeWidth={3.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
