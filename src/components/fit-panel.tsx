"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

/** The panel never gets shorter than this many rem (a few rows) or taller than that (a screenful). */
const MIN_REM = 22;
const MAX_REM = 64;

/** The height a panel takes: what is left of the window under its top edge, less the bottom the page keeps free. */
export function fittedHeight({
  viewport,
  top,
  reserve,
  min,
  max,
}: {
  viewport: number;
  /** Where the panel starts, measured from the top of the page. */
  top: number;
  /** The page's own padding under its content (on a phone, where the tab bar sits). */
  reserve: number;
  min: number;
  max: number;
}) {
  return Math.round(Math.min(max, Math.max(min, viewport - top - reserve)));
}

/**
 * The panel of a list: a labelled region that takes the room left in the window under whatever is above it, so the
 * table's footer is in view without scrolling the page. What is above it isn't fixed: the "confirm your email"
 * notice streams in after the page, a header can wrap onto two lines, a tab row can be there or not. So the
 * panel measures instead of guessing, and measures again when the window or anything above it changes size.
 * Until it has (the server's HTML, and without JavaScript) its CSS `className` gives a height that suits a page
 * with nothing extra above it.
 */
export function FitPanel({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const page = document.getElementById("main")?.firstElementChild ?? element.parentElement;
    let frame = 0;

    const fit = () => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const reserve = page ? Number.parseFloat(getComputedStyle(page).paddingBottom) || 0 : 0;
      const height = fittedHeight({
        viewport: window.innerHeight,
        top: element.getBoundingClientRect().top + window.scrollY,
        reserve,
        min: MIN_REM * rem,
        max: MAX_REM * rem,
      });
      element.style.height = `${height}px`;
    };
    // Many changes can arrive in one frame (a resize, the notice appearing); fit once, before the next paint.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (observer && page) observer.observe(page);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, []);

  return (
    <section ref={panel} aria-label={label} className={className}>
      {children}
    </section>
  );
}
