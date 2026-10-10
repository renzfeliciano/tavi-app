"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { BrandMascot, type MascotExpression } from "@/components/brand/brand-mascot";
import { buttonVariants } from "@/components/ui/button";
import { cornerBusyFor } from "@/lib/greeting-state";
import { type InsightKind, type MascotInsight, selectInsight } from "./insights";

const STORAGE_KEY = "tavi:mascot-dismissed";
/** The bubble stays this long, then the Stamp settles into the corner (tap it to read again). */
const BUBBLE_MS = 12_000;
const DONE_MS = 3_200;
/** The editors are where the work happens; the note never opens itself over them (tap the Stamp to read it). */
const EDITOR_PATH = /^\/(quotes|invoices)\/(new|[0-9a-f-]{36})(\/|$)/;

const MOOD: Record<InsightKind, MascotExpression> = {
  critical: "concerned",
  action: "curious",
  recommended: "happy",
  informational: "neutral",
  positive: "happy",
};

function readDismissed(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Only a convenience; it will simply say it again next visit.
  }
}

/**
 * The Stamp as a small companion (D22). It points at existing screens and
 * never does the work itself. It says one thing at a time, only what the data
 * says (see insights.ts), only on pages where it matters, and stays out of the
 * way: the wrapper ignores the pointer, only the card and the Stamp take clicks.
 */
export function MascotCompanion({ insights }: { insights: MascotInsight[] }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const previous = useRef<string[] | null>(null);

  // Wait out the sign-in greeting, then become visible. Dismissals live for the browser session.
  useEffect(() => {
    const start = window.setTimeout(() => {
      setDismissed(readDismissed());
      setReady(true);
    }, cornerBusyFor());
    return () => window.clearTimeout(start);
  }, []);

  const insight = ready ? selectInsight(insights, pathname, dismissed) : null;
  const insightId = insight?.id;

  // A new thing to say opens the bubble; after a while it settles to the Stamp alone.
  useEffect(() => {
    if (!insightId) return;
    const show = window.setTimeout(() => setOpen(!EDITOR_PATH.test(pathname)), 0);
    const settle = window.setTimeout(() => setOpen(false), BUBBLE_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(settle);
    };
  }, [insightId, pathname]);

  // Something that needed attention is gone from the data: acknowledge it, briefly.
  useEffect(() => {
    const now = insights.filter((i) => i.kind !== "positive").map((i) => i.id);
    const before = previous.current;
    previous.current = now;
    if (!before || !before.some((id) => !now.includes(id))) return;
    const on = window.setTimeout(() => setDone(true), 0);
    const off = window.setTimeout(() => setDone(false), DONE_MS);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [insights]);

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    writeDismissed(next);
  }

  if (!ready || (!insight && !done)) return null;
  const mood: MascotExpression = done ? "celebrating" : MOOD[insight?.kind ?? "informational"];
  const showBubble = done || open;
  const action = insight?.action && insight.action.href !== pathname ? insight.action : null;

  return (
    <div
      data-phase="in"
      className="welcome-greeting pointer-events-none fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 flex max-w-[calc(100vw-2rem)] items-end gap-2 lg:right-8 lg:bottom-8"
      onKeyDown={(event) => {
        if (event.key === "Escape" && insight) dismiss(insight.id);
      }}
    >
      {showBubble && (
        <div className="welcome-bubble pointer-events-auto relative mb-5 w-72 max-w-full rounded-xl border border-border bg-card p-3.5 shadow-lg">
          <p role="status" className="pr-6 text-sm text-pretty">
            {done ? "Nice. That's taken care of." : insight?.message}
          </p>
          {!done && action && (
            <Link
              href={action.href as Route}
              onClick={() => insight && dismiss(insight.id)}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2.5`}
            >
              {action.label}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          )}
          {!done && insight && (
            <button
              type="button"
              onClick={() => dismiss(insight.id)}
              aria-label="Dismiss"
              className="absolute top-2 right-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon aria-hidden="true" className="size-3.5" />
            </button>
          )}
          <span
            aria-hidden="true"
            className="absolute -right-[5px] bottom-6 size-2.5 rotate-45 border-t border-r border-border bg-card"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={showBubble}
        aria-label={showBubble ? "Hide Tavi's note" : "Show Tavi's note"}
        className="welcome-mascot pointer-events-auto rounded-xl outline-offset-2"
      >
        <BrandMascot expression={mood} size={showBubble ? "lg" : "md"} animated={done} />
      </button>
    </div>
  );
}
