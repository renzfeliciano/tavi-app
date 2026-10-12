"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { replay } from "./live";

/**
 * The closing card: its words and button, and its scene (cta-scene.tsx), which
 * plays by itself. When someone comes to the button, reaches it with a keyboard,
 * or presses it, the Stamp comes down on the statement at once, as if answering
 * them, and the scene then carries on by itself. The answer is a class on the
 * scene's wrapper (`home-cta-hit`, home.css) that is taken off when it ends.
 */
export function CtaStage({ scene, children, className }: { scene: ReactNode; children: ReactNode; className?: string }) {
  const answer = useRef<HTMLDivElement>(null);

  const answerIfButton = (target: EventTarget | null, from?: EventTarget | null) => {
    const link = target instanceof Element ? target.closest("a") : null;
    if (!link) return;
    // Moving about inside the button is not coming to it again.
    if (from instanceof Node && link.contains(from)) return;
    replay(answer.current, "home-cta-hit");
  };

  // The answer ends when the Stamp's has: the scene then carries on by itself. (Listened for here, not through React, which only knows the event where the browser has animations.)
  useEffect(() => {
    const element = answer.current;
    if (!element) return;
    const done = (event: Event) => {
      if ((event as AnimationEvent).animationName === "home-cta-stamp-hit") element.classList.remove("home-cta-hit");
    };
    element.addEventListener("animationend", done);
    return () => element.removeEventListener("animationend", done);
  }, []);

  return (
    <div
      className={className}
      onPointerOver={(event) => answerIfButton(event.target, event.relatedTarget)}
      onFocus={(event) => answerIfButton(event.target)}
      onPointerDown={(event) => answerIfButton(event.target)}
    >
      {children}
      <div ref={answer}>{scene}</div>
    </div>
  );
}
