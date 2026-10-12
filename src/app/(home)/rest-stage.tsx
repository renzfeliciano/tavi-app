"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { H2 } from "./sizes";
import { replay } from "./live";
import { SectionStamp } from "./section-stamp";

/** How long it stays awake after the pointer last moved over the rows. */
const DOZE_AFTER_MS = 1600;
/** How long a startle lasts. */
const STARTLED_MS = 1400;

type Mood = "resting" | "curious" | "concerned";
type Row = { title: string; body: string; icon: ReactNode; picture: ReactNode };

/**
 * "And the rest of the job": a heading and its rows, with a Stamp that is asleep
 * until someone looks. A pointer over the rows wakes it (curious), and it dozes
 * off again once the pointer has stopped or left for a moment; pressing it
 * startles it (concerned, with a jolt), and it settles back down. It is perched
 * on the activity card (`feed`) in the column under the heading. The rows'
 * pictures and the card play by themselves in CSS (rest-pictures.tsx,
 * activity-feed.tsx); this is the only script, and it is only a mood.
 */
export function RestStage({ title, intro, rows, feed, className }: { title: string; intro: string; rows: Row[]; feed?: ReactNode; className?: string }) {
  const [mood, setMood] = useState<Mood>("resting");
  const over = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const jolt = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const later = (ms: number, then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
  const doze = () => setMood("resting");
  /** Awake, and asleep again if nothing moves for a moment. */
  const wake = () => {
    over.current = true;
    setMood((now) => (now === "concerned" ? now : "curious"));
    later(DOZE_AFTER_MS, doze);
  };
  const leave = () => {
    over.current = false;
    later(DOZE_AFTER_MS, doze);
  };
  const poke = () => {
    setMood("concerned");
    replay(jolt.current, "home-startle");
    later(STARTLED_MS, () => {
      if (over.current) {
        setMood("curious");
        later(DOZE_AFTER_MS, doze);
      } else {
        doze();
      }
    });
  };

  return (
    <div className={className}>
      <div className="home-reveal-left grid content-start justify-items-start gap-4 lg:sticky lg:top-24 lg:self-start">
        <h2 className={H2}>{title}</h2>
        <p className="max-w-md text-pretty text-muted-foreground">{intro}</p>
        {/* The sleeping Stamp is perched on an activity card that fills the column, so the heading is not left alone beside six tall rows. */}
        <div className="mt-2 grid w-full max-w-sm justify-items-end">
          <div ref={jolt} onPointerDown={poke} className="relative z-10 mr-6 -mb-1.5 touch-manipulation select-none">
            <SectionStamp expression={mood} size="xl" className="h-auto w-20 sm:w-24" />
          </div>
          {feed}
        </div>
      </div>
      <ul onPointerEnter={wake} onPointerMove={wake} onPointerLeave={leave} className="grid divide-y divide-border border-y border-border">
        {rows.map(({ icon, title: rowTitle, body, picture }, index) => (
          <li
            key={rowTitle}
            className="home-reveal-right grid grid-cols-[auto_1fr] items-start gap-x-4 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-x-5"
            style={{ "--i": index % 3 } as CSSProperties}
          >
            <span className="grid size-10 place-items-center rounded-lg bg-stamp-subtle text-stamp">{icon}</span>
            <div className="grid gap-1">
              <h3 className="font-heading text-base font-semibold">{rowTitle}</h3>
              <p className="text-sm text-pretty text-muted-foreground">{body}</p>
            </div>
            <div className="col-start-2 mt-3 sm:col-start-3 sm:row-start-1 sm:mt-0">{picture}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
