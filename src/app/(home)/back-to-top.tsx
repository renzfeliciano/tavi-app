"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Starts the pull again from the beginning: take the attribute off, force a reflow, put it back. */
function pull(element: HTMLElement) {
  element.removeAttribute("data-pulled");
  void element.offsetWidth;
  element.setAttribute("data-pulled", "true");
}

/**
 * A way back to the top, offered once the end of the page (the element with id
 * `watch`) has scrolled into view and gone again when it has not. On a phone it
 * takes the right-hand end of the Create an account bar (home.css makes room
 * for it); from the tablet up it floats at the bottom right with its words.
 *
 * The button is the Stamp itself, and it plays without being touched: it pops
 * in when the end of the page comes into view, then hops every few seconds,
 * taps its check as it lands, and the arrow bobs up with it. Reaching for it
 * sets the Stamp wiggling. Pressing it sends the whole button flying up the
 * screen as the page scrolls up behind it (`data-pulled`, set again on every
 * press and taken off when the flight ends, so it pops in again next time).
 * It is an attribute and not a class because React rewrites the class list
 * whenever the button hides, and the page scrolls away the moment it is
 * pressed. home.css plays all of it only where motion is welcome.
 *
 * It is a plain link to `#top`, so the browser does the scrolling (smoothly,
 * unless motion is reduced, in home.css) and keyboard focus follows. Where the
 * browser cannot watch for scrolling it is simply not offered.
 */
export function BackToTop({ watch }: { watch: string }) {
  const [shown, setShown] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const end = document.getElementById(watch);
    if (!end || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setShown(entries[entries.length - 1]?.isIntersecting ?? false);
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, [watch]);

  // The flight is over: take the pull off, so the button is ready to pop in and hop again. Only the flight counts; the hop, the tap and the bob end all the time.
  useEffect(() => {
    const element = link.current;
    if (!element) return;
    const landed = (event: Event) => {
      if ((event as AnimationEvent).animationName === "home-top-fly") element.removeAttribute("data-pulled");
    };
    element.addEventListener("animationend", landed);
    return () => element.removeEventListener("animationend", landed);
  }, []);

  return (
    <a
      ref={link}
      href="#top"
      onClick={(event) => pull(event.currentTarget)}
      data-shown={shown ? "true" : undefined}
      // While it is hidden it is out of the tab order and out of the accessibility tree.
      {...(shown ? {} : { "aria-hidden": true, tabIndex: -1 })}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        "home-top fixed right-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 size-12 rounded-full bg-card shadow-lg md:right-6 md:bottom-6 md:h-12 md:w-auto md:gap-2 md:pr-5 md:pl-3 md:pointer-coarse:w-auto",
        "motion-safe:transition-[opacity,translate,background-color,border-color,color,box-shadow]",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      {/* Named "size-auto" so the button's rule that squeezes every icon to 1rem leaves the Stamp at its own size; raised so its check sits inside the pill, with its head above it. */}
      <BrandMascot expression="happy" size="md" calm className="size-auto -translate-y-2.5" />
      <span
        aria-hidden="true"
        className="home-top-arrow grid place-items-center max-md:absolute max-md:-top-1.5 max-md:-right-1.5 max-md:size-5 max-md:rounded-full max-md:bg-primary max-md:text-primary-foreground max-md:shadow-sm"
      >
        <ArrowUpIcon className="size-4 max-md:size-3" />
      </span>
      <span className="max-md:sr-only">Back to top</span>
    </a>
  );
}
