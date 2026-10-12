import { useEffect, useRef, useState, type PointerEvent } from "react";
import { motionWelcome, watchView } from "./live";
import { TICK_MS, type Timeline } from "./scenes";

/**
 * The clock behind a row of cards that play as little scenes in turn
 * (steps-stage.tsx, send-stage.tsx). While the row is on screen it counts
 * ticks along `timeline` and goes round again at the end. A mouse over a card
 * plays that card's scene and holds on its finished picture until it leaves; a
 * click or tap plays it again. `tick` is null, and nothing runs, wherever motion
 * is not welcome or scrolling cannot be watched, and while the row is off
 * screen: the cards then draw their finished pictures. `jumps` counts the times
 * a scene has been started over by hand, for a piece that reacts to each.
 *
 *   const { box, tick, card, jumps } = useDirector(TIMELINE);
 *   <div ref={box}> … <li {...card(index)}> … </li> </div>
 */
export function useDirector(timeline: Timeline) {
  const [tick, setTick] = useState<number | null>(null);
  const [jumps, setJumps] = useState(0);
  const clock = useRef(0);
  const pinned = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element || !motionWelcome()) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const run = () => {
      clock.current = 0;
      setTick(0);
      timer = setInterval(() => {
        const hold = pinned.current;
        // Held on a card the mouse is over: stay on its finished picture.
        if (hold !== null && clock.current >= timeline.starts[hold]! + timeline.lengths[hold]!) return;
        clock.current = clock.current >= timeline.total ? 0 : clock.current + 1;
        setTick(clock.current);
      }, TICK_MS);
    };
    const stopWatching = watchView(element, (visible) => {
      stop();
      if (visible) run();
      else setTick(null);
    });
    return () => {
      stopWatching?.();
      stop();
    };
  }, [timeline]);

  /** Begin scene `i` over again, if the pictures are playing at all. */
  const jump = (i: number) => {
    if (tick === null) return;
    clock.current = timeline.starts[i]!;
    setTick(timeline.starts[i]!);
    setJumps((n) => n + 1);
  };

  /** The handlers for card `index`: hover pins its scene, a click or tap replays it. */
  const card = (index: number) => ({
    onPointerEnter: (event: PointerEvent) => {
      // A finger touches and lifts at once; only a mouse stays over a card.
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      if (tick === null) return;
      pinned.current = index;
      if (timeline.stepAt(clock.current) !== index) jump(index);
    },
    onPointerLeave: () => {
      pinned.current = null;
    },
    onClick: () => jump(index),
  });

  return { box, tick, card, jumps };
}
