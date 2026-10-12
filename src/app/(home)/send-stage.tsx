"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDirector } from "./director";
import { replay } from "./live";
import { CHANNELS, EMAIL_STATIC, LINK_STATIC, PDF_STATIC, channelMood } from "./scenes";
import { SectionStamp } from "./section-stamp";
import { EmailPreview, LinkPreview, PdfPreview } from "./send-previews";

/** How each card arrives as the page is scrolled to (home.css): from the left, up from small, from the right. */
const ENTRANCE = ["home-reveal-left", "home-reveal-zoom", "home-reveal-right"] as const;
const RESTING = [EMAIL_STATIC, PDF_STATIC, LINK_STATIC] as const;
/** Which way the quotation leaves the Stamp for each card. */
const TO = ["left", "center", "right"] as const;
/** The routes from the Stamp to the cards' top edges: the card's centres are at 1/6, 1/2 and 5/6 of the row. */
const ROUTES = ["M150 0 C150 40 50 30 50 72", "M150 0 L150 72", "M150 0 C150 40 250 30 250 72"] as const;

type Channel = { title: string; body: string; icon: ReactNode };

/**
 * "Send it the way your customers read it", alive. While it is on screen the
 * three pictures play in turn: the email arrives a piece at a time and its
 * button is pressed and opened, the PDF is drawn and its payment code scanned,
 * and the customer's page is approved and the business told (scenes.ts).
 *
 * The Stamp is the outbox here, not a traveller (the steps above it walk a Stamp
 * along their cards): it stays at the head of the row, presses, and sends a
 * quotation down a dashed route to the card that is up next. Its mood follows
 * the story, pleased by the email, curious over the PDF, waiting on the
 * customer, celebrating when they approve. A mouse over a card plays it and
 * holds on its finished picture; a click or tap plays it again. Off screen, or
 * where motion is not welcome or scrolling cannot be watched, it is the finished
 * pictures and the Stamp, and nothing moves.
 */
export function SendStage({ channels, documentName }: { channels: Channel[]; documentName: string }) {
  const { box, tick, card, jumps } = useDirector(CHANNELS);
  const paper = useRef<HTMLSpanElement>(null);
  const press = useRef<HTMLDivElement>(null);

  const frames = tick === null ? RESTING : CHANNELS.locals(tick);
  const step = tick === null ? 0 : CHANNELS.stepAt(tick);
  const mood = tick === null ? "happy" : channelMood(step, frames[step]!);

  // Each time a card is up next (when the run begins, goes round again, or a card is clicked), the Stamp presses and sends.
  const sending = tick === null ? -1 : step;
  useEffect(() => {
    if (sending < 0) return;
    replay(press.current, "home-pressing");
    replay(paper.current, "home-sending");
  }, [sending, jumps]);

  return (
    <div ref={box}>
      <div className="home-outbox relative mt-10 md:mt-2">
        <div ref={press} aria-hidden="true" className="mx-auto w-fit">
          <SectionStamp expression={mood} imprint={false} className="h-auto w-14 md:w-[4.5rem]" />
        </div>
        {/* From the tablet up, where the cards sit side by side: a route to each, and the quotation that travels along it. */}
        <div aria-hidden="true" className="relative hidden h-[4.5rem] md:block">
          <svg viewBox="0 0 300 72" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {ROUTES.map((d, index) => (
              <path
                key={d}
                d={d}
                data-route={index}
                data-active={tick !== null && step === index ? "" : undefined}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="4 5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="text-border-strong data-[active]:text-stamp motion-safe:transition-colors motion-safe:duration-(--duration-slow)"
              />
            ))}
          </svg>
          <span ref={paper} data-to={TO[step]} className="home-send-paper size-7 place-items-center rounded-md border border-stamp/40 bg-card text-stamp shadow-md">
            <FileTextIcon className="size-3.5" />
          </span>
        </div>
        <ul className="mt-4 grid gap-6 md:mt-0 md:grid-cols-3">
          {channels.map(({ icon, title, body }, index) => {
            const lit = tick !== null && step === index;
            const picture = tick === null ? undefined : frames[index];
            return (
              <li
                key={title}
                data-lit={lit ? "true" : undefined}
                {...card(index)}
                className={cn(
                  ENTRANCE[index],
                  "home-lift grid content-start gap-4 rounded-xl border bg-background p-5 motion-safe:transition-[border-color,box-shadow]",
                  lit ? "border-stamp/50 shadow-md" : "border-border",
                )}
                style={{ "--i": index } as CSSProperties}
              >
                <div className="grid min-h-60 content-center overflow-hidden rounded-lg bg-surface-sunken p-4">
                  <div className="home-parallax">
                    {index === 0 && <EmailPreview documentName={documentName} tick={picture} />}
                    {index === 1 && <PdfPreview documentName={documentName} tick={picture} />}
                    {index === 2 && <LinkPreview documentName={documentName} tick={picture} />}
                  </div>
                </div>
                <div className="grid content-start justify-items-start gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-stamp-subtle text-stamp">{icon}</span>
                  <h3 className="font-heading text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-pretty text-muted-foreground">{body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
