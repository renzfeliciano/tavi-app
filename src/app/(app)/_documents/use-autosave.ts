"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "blocked"; message: string }
  | { kind: "failed"; message: string };

type SaveOutcome = { ok: true } | { ok: false; message: string; retry: boolean };

const RETRY_DELAY_MS = 5000;

/**
 * Saves `value` a moment after it stops changing (§G.3 "autosave for
 * drafts"). One save runs at a time; changes made meanwhile are saved right
 * after, so the last state always wins. Warns before leaving with unsaved work.
 */
export function useAutosave<T>({
  value,
  enabled,
  validate,
  save,
  delayMs = 800,
}: {
  value: T;
  /** False until the person changes something, so opening a page never saves. */
  enabled: boolean;
  /** A reason not to save yet (fields that need fixing), or null. */
  validate: (value: T) => string | null;
  save: (value: T) => Promise<SaveOutcome>;
  delayMs?: number;
}) {
  const [status, setStatus] = useState<AutosaveStatus>({ kind: "idle" });
  const [savedValue, setSavedValue] = useState<T | null>(null);
  const latest = useRef(value);
  const unsaved = useRef(false);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const runRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    latest.current = value;
    unsaved.current = enabled && value !== savedValue;
  });

  const run = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    const snapshot = latest.current;
    const problem = validate(snapshot);
    if (problem) {
      setStatus({ kind: "blocked", message: problem });
      return;
    }
    inFlight.current = true;
    setStatus({ kind: "saving" });
    try {
      const outcome = await save(snapshot);
      if (outcome.ok) {
        setSavedValue(snapshot);
        setStatus({ kind: "saved", at: Date.now() });
      } else {
        setStatus({ kind: outcome.retry ? "failed" : "blocked", message: outcome.message });
      }
    } catch {
      // Offline or the server hiccuped: keep the work and try again shortly.
      setStatus({ kind: "failed", message: "Couldn't save. Check your connection; we'll keep trying." });
      window.setTimeout(() => void runRef.current(), RETRY_DELAY_MS);
    } finally {
      inFlight.current = false;
    }
    if (queued.current || latest.current !== snapshot) {
      queued.current = false;
      if (latest.current !== snapshot) void runRef.current();
    }
  }, [save, validate]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void runRef.current(), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, enabled, delayMs]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (unsaved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Changed since the last save and not saving right now: say so.
  const shown: AutosaveStatus =
    enabled && value !== savedValue && (status.kind === "idle" || status.kind === "saved")
      ? { kind: "pending" }
      : status;
  return { status: shown };
}
