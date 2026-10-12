import { useEffect, useRef } from "react";
import { replay } from "./live";

/**
 * One Stamp that stands on the top edge of whichever card is `index`, and hops
 * to the next when it changes. It places itself by setting two CSS variables
 * (--sx, --sy: where its top-left corner goes, in pixels) on its own element,
 * and home.css does the rest from the tablet up. On a phone, where the cards
 * are stacked, it stays by the heading and only hops on the spot.
 *
 *   const roam = useRoam(index);
 *   <div ref={roam.container} className="relative">
 *     <div ref={roam.stamp} className="home-roam"><div ref={roam.hop}>…</div></div>
 *     <li ref={(el) => { roam.items.current[0] = el; }}>…</li>
 *
 * The cards' own offsets are used, which ignore transforms, so a card that is
 * lifting, tilting or arriving does not throw the Stamp.
 */
export function useRoam(index: number) {
  const container = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const stamp = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const was = useRef<number | null>(null);

  useEffect(() => {
    const box = container.current;
    const el = stamp.current;
    if (!box || !el) return;

    const place = () => {
      const target = items.current[index];
      if (!target) return;
      el.style.setProperty("--sx", `${target.offsetLeft + target.offsetWidth / 2 - el.offsetWidth / 2}px`);
      el.style.setProperty("--sy", `${target.offsetTop - el.offsetHeight + 6}px`);
      el.dataset.placed = "true";
    };

    place();
    // Only after it has been put in its first place does it learn to glide, so it does not swoop in from a corner on load.
    const frame = requestAnimationFrame(() => {
      el.dataset.ready = "true";
    });
    if (was.current !== null && was.current !== index) replay(hop.current, "home-hopping");
    was.current = index;

    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    observer?.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [index]);

  return { container, items, stamp, hop };
}
