"use client";

import { useEffect, useRef } from "react";

/**
 * The home page's stage. It tells the page's CSS where the pointer is, as two
 * numbers from -1 to 1 across the window (--mx, --my), and the CSS leans the
 * glows, the floating chips and the sample card toward it (home.css, "depth").
 *
 * Only a fine, hovering pointer that has not asked for less motion gets this.
 * A phone, a reduced-motion setting or a browser that cannot tell leaves the
 * numbers unset, and the page holds still. It does one thing and renders
 * nothing of its own: the page is the same page without it.
 */
export function HoverStage({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    // Environments without matchMedia (tests) have no pointer to follow.
    if (!stage || typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const tidy = (n: number) => String(Math.round(Math.max(-1, Math.min(1, n)) * 100) / 100);
    const lean = (x: number, y: number) => {
      stage.style.setProperty("--mx", tidy(x));
      stage.style.setProperty("--my", tidy(y));
    };

    let frame = 0;
    function onMove(event: MouseEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => lean((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1));
    }
    function onLeave() {
      cancelAnimationFrame(frame);
      lean(0, 0);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
