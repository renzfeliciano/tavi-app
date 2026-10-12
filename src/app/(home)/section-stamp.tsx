"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMascot, type MascotExpression, type MascotSize } from "@/components/brand/brand-mascot";

/**
 * The Stamp that keeps a section of the home page company (DESIGN.md, "Mascot
 * language": an exception for the public home). It is the real, living mascot: it blinks,
 * breathes, glances and its eyes follow the pointer. It also arrives with the
 * section (a pop on scroll, in home.css) and presses once the first time it is
 * mostly in view, so the press is seen and not spent off-screen.
 *
 * Decoration only: every section says what it says in words. A browser that
 * cannot watch for scrolling gets the still-pressed Stamp, alive all the same.
 * `chip` sets it on light paper, for a coloured band where its ink body would
 * be lost.
 */
export function SectionStamp({
  expression,
  size = "lg",
  imprint,
  chip = false,
  className,
}: {
  expression: MascotExpression;
  size?: MascotSize;
  imprint?: boolean;
  chip?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      // The light chip is its own light-theme scope, so the paper and ink are the Stamp's own in every theme.
      {...(chip ? { "data-theme": "light" } : {})}
      className={chip ? "home-reveal-pop home-depth inline-flex rounded-2xl border border-border bg-card p-2 shadow-md" : "home-reveal-pop home-depth inline-flex"}
    >
      <BrandMascot expression={expression} size={size} imprint={imprint} animated={seen} className={className} />
    </div>
  );
}
