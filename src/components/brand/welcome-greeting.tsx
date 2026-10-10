"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { holdCornerUntil } from "@/lib/greeting-state";
import { GREETING_DURATION_MS, takeWelcome, welcomeMessage } from "@/lib/welcome-greeting";

/**
 * The Stamp pops up in the corner right after sign-in, says hello, and leaves
 * (D20). It never blocks the page (pointer-events-none), plays once per
 * sign-in, and under `prefers-reduced-motion` the same words appear without
 * movement. The message is announced politely to screen readers.
 */
export function WelcomeGreeting({ userName }: { userName: string }) {
  const [phase, setPhase] = useState<"idle" | "in" | "out">("idle");

  // Taken once, kept in a ref so React's dev double-run of effects still greets.
  const taken = useRef<boolean | null>(null);

  useEffect(() => {
    taken.current ??= takeWelcome(window.sessionStorage);
    if (!taken.current) return;
    holdCornerUntil(Date.now() + GREETING_DURATION_MS + 450);
    const timers = [
      window.setTimeout(() => setPhase("in"), 0),
      window.setTimeout(() => setPhase("out"), GREETING_DURATION_MS),
      window.setTimeout(() => setPhase("idle"), GREETING_DURATION_MS + 450),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (phase === "idle") return null;
  return (
    <div
      role="status"
      data-phase={phase}
      className="welcome-greeting pointer-events-none fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 flex items-end gap-2 lg:right-8 lg:bottom-8"
    >
      <p className="welcome-bubble relative mb-6 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-lg">
        {welcomeMessage(userName)}
        <span
          aria-hidden="true"
          className="absolute top-1/2 -right-[5px] size-2.5 -translate-y-1/2 rotate-45 border-t border-r border-border bg-card"
        />
      </p>
      <span className="welcome-mascot">
        <BrandMascot expression="happy" size="lg" animated />
      </span>
    </div>
  );
}
