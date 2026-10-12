// Small helpers for the home page's live pieces (the three step scenes, the
// roaming Stamp, the sleepy Stamp). Nothing here moves anything by itself: the
// pieces ask first whether motion is welcome and whether scrolling can be watched.

/** True when the person has not asked for less motion (and the browser can tell). */
export function motionWelcome(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Calls `onChange` as `element` comes into view and leaves it. Returns what to
 * call to stop, or null where the browser cannot watch for scrolling (the
 * piece then stays on its resting frame).
 */
export function watchView(element: Element, onChange: (visible: boolean) => void, threshold = 0.4): (() => void) | null {
  if (typeof IntersectionObserver === "undefined") return null;
  const observer = new IntersectionObserver(
    (entries) => {
      onChange(entries[entries.length - 1]?.isIntersecting ?? false);
    },
    { threshold },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/** Plays a CSS animation again from the start: take the class off, force a reflow, put it back. */
export function replay(element: HTMLElement | null, className: string) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
