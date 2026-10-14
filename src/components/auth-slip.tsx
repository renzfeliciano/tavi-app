import { CheckIcon } from "lucide-react";

/** The three moments of a job, in order. The last one is the point of it all, so it carries the check. */
const FLOW = [
  ["Quote", "approved"],
  ["Invoice", "sent"],
  ["Payment", "recorded"],
] as const;

/**
 * The paper slip under the Stamp on the sign-in pages' side panel: a small sheet headed "From quote to paid" with the
 * three moments of a job on hairline rows, the last one stamped with the check. Decoration for the panel beside the
 * form, which hides it from assistive technology; nothing on it moves.
 */
export function AuthSlip() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <p className="border-b border-dashed border-border-strong px-5 py-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
        From quote to paid
      </p>
      <ol className="relative px-5 py-1 font-mono text-sm before:absolute before:top-7 before:bottom-7 before:left-[1.9375rem] before:w-px before:bg-foreground/25">
        {FLOW.map(([what, state], i) => {
          const last = i === FLOW.length - 1;
          return (
            <li key={what} className="relative grid grid-cols-[1.375rem_1fr_auto] items-center gap-x-4 py-3">
              <span
                className={
                  last
                    ? "relative z-10 grid size-[1.375rem] place-items-center rounded-full bg-stamp text-white"
                    : "relative z-10 grid size-[1.375rem] place-items-center rounded-full border border-foreground/40 bg-card text-[0.65rem] text-foreground tabular-nums"
                }
              >
                {last ? <CheckIcon className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="font-semibold">{what}</span>
              <span className="text-muted-foreground">{state}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
