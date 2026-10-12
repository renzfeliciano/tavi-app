"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDirector } from "./director";
import { useRoam } from "./roaming";
import { LENGTHS, MAKE_LENGTH, PAY_STATIC, SEND_STATIC, STARTS, STEPS, locals, stampMood, stepAt } from "./scenes";
import { SectionStamp } from "./section-stamp";
import { MakePreview, PaidPreview, SendPreview } from "./step-previews";

/**
 * "From job to paid in three steps", alive. While it is on screen the three
 * pictures play as little scenes in turn (the quotation being typed and added
 * up, then sent, then paid in two parts, scenes.ts) and one Stamp hops from card
 * to card as each begins, curious at first and celebrating at the end. A mouse
 * over a card plays that step and holds on its finished picture; a click or tap
 * plays it again. Off screen, or where motion is not welcome or scrolling cannot
 * be watched, it is the finished pictures and the Stamp on the first card, and
 * nothing moves (the same page as before it came alive).
 */
export function StepsStage({ steps }: { steps: { title: string; body: string }[] }) {
  // tick is null when nothing moves, and each picture rests on its finished frame.
  const { box, tick, card } = useDirector(STEPS);

  const [first, second, third] = tick === null ? [MAKE_LENGTH, SEND_STATIC, PAY_STATIC] : locals(tick);
  const step = tick === null ? 0 : stepAt(tick);
  const here = [first, second, third][step]!;
  const mood = tick === null ? "curious" : stampMood(step, here);
  const { container, items, stamp, hop } = useRoam(step);

  return (
    <div ref={box}>
      <div ref={container} className="relative mt-14 md:mt-4 md:pt-24">
        {/* One Stamp for the whole row: by the heading on a phone, on the card it is up to from the tablet up. */}
        <div ref={stamp} aria-hidden="true" className="home-roam">
          <div ref={hop}>
            <SectionStamp expression={mood} imprint={false} className="h-auto w-14 md:w-[4.5rem]" />
          </div>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((item, index) => {
            const last = index === steps.length - 1;
            const lit = tick !== null && step === index;
            const done = tick !== null && tick >= STARTS[index]! + LENGTHS[index]!;
            return (
              <li
                key={item.title}
                ref={(element) => {
                  items.current[index] = element;
                }}
                data-lit={lit ? "true" : undefined}
                {...card(index)}
                className={cn(
                  "home-reveal-tilt home-lift relative grid content-start gap-4 rounded-xl border bg-card p-5 motion-safe:transition-[border-color,box-shadow]",
                  lit ? "border-stamp/50 shadow-md" : "border-border",
                )}
                style={{ "--i": index } as React.CSSProperties}
              >
                <div className="grid min-h-44 content-center rounded-lg bg-surface-sunken p-3">
                  {index === 0 && <MakePreview tick={tick === null ? undefined : first} />}
                  {index === 1 && <SendPreview tick={tick === null ? undefined : second} />}
                  {index === 2 && <PaidPreview tick={tick === null ? undefined : third} />}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      last || done ? "bg-stamp text-white" : "border border-foreground/40 font-mono text-xs text-foreground tabular-nums",
                    )}
                  >
                    {last || done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
                </div>
                <p className="text-pretty text-muted-foreground">{item.body}</p>
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-[1.625rem] z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground md:grid"
                  >
                    <ArrowRightIcon className="home-nudge size-3.5" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
