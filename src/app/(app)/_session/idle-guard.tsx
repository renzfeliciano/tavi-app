"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { clientIdleLimitMs, idleStatus, SESSION_POLICY } from "@/modules/identity/client";

const TICK_MS = 5_000;
/** Activity is noted at most this often; pointer-move storms cost nothing. */
const ACTIVITY_THROTTLE_MS = 5_000;
/** While the person is active, tell the server often enough that it renews before it would expire. */
const KEEP_ALIVE_MS = (SESSION_POLICY.renewAfterSeconds - 60) * 1000;
const CHANNEL = "tavi-session";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Signs the person out when they have been idle (D23). The server ends the
 * session on its own either way; this makes the screen say so, warns for the
 * last minute with a way to stay, and signs out every open tab. Activity in
 * any tab counts. Nothing is stored in the browser: tabs talk over a
 * BroadcastChannel and the clock is kept in memory.
 */
export function IdleGuard() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastActivity = useRef(0);
  const lastKeepAlive = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    const clock = Date.now();
    lastActivity.current = clock;
    lastKeepAlive.current = clock;
    const bus = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;
    channel.current = bus;
    const limitMs = clientIdleLimitMs();
    const warningMs = SESSION_POLICY.idleWarningSeconds * 1000;

    function leave(announce: boolean) {
      if (leaving.current) return;
      leaving.current = true;
      if (announce) bus?.postMessage({ type: "signed-out" });
      void authClient.signOut().finally(() => window.location.replace("/sign-in?reason=idle"));
    }

    function note(at: number, share: boolean) {
      if (at - lastActivity.current < ACTIVITY_THROTTLE_MS && share) return;
      lastActivity.current = at;
      if (share) bus?.postMessage({ type: "activity", at });
    }

    function onActivity() {
      note(Date.now(), true);
      // Someone who is typing or scrolling is not idle: dismiss a warning that is showing.
      setRemaining((r) => (r === null ? r : null));
    }

    function tick() {
      const now = Date.now();
      const state = idleStatus({ lastActivityAt: lastActivity.current, now, limitMs, warningMs });
      if (state.status === "expired") return leave(true);
      setRemaining(state.status === "warning" ? state.remainingMs : null);
      if (state.status === "active" && now - lastKeepAlive.current >= KEEP_ALIVE_MS && now - lastActivity.current < KEEP_ALIVE_MS) {
        lastKeepAlive.current = now;
        void authClient.getSession().catch(() => undefined);
      }
    }

    // A warning is answered deliberately (the button), not by a stray scroll.
    function onPassive() {
      if (document.visibilityState === "visible") tick();
    }

    const handlers = ACTIVITY_EVENTS.map((name) => {
      const fn = name === "scroll" || name === "wheel" ? () => note(Date.now(), true) : onActivity;
      window.addEventListener(name, fn, { passive: true, capture: true });
      return [name, fn] as const;
    });
    bus?.addEventListener("message", (event: MessageEvent<{ type: string; at?: number }>) => {
      if (event.data.type === "activity" && typeof event.data.at === "number") note(event.data.at, false);
      if (event.data.type === "signed-out") leave(false);
    });
    document.addEventListener("visibilitychange", onPassive);
    const timer = window.setInterval(tick, TICK_MS);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onPassive);
      for (const [name, fn] of handlers) window.removeEventListener(name, fn, { capture: true });
      bus?.close();
    };
  }, []);

  function stay() {
    const now = Date.now();
    lastActivity.current = now;
    channel.current?.postMessage({ type: "activity", at: now });
    setRemaining(null);
    void authClient.getSession().catch(() => undefined);
  }

  const seconds = remaining === null ? 0 : Math.ceil(remaining / 1000);
  return (
    <Dialog open={remaining !== null} onOpenChange={(open) => !open && stay()}>
      <DialogContent showCloseButton={false} className="items-center text-center">
        <div className="mx-auto">
          <BrandMascot expression="waiting" size="lg" />
        </div>
        <DialogHeader className="items-center">
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            For your security, you&apos;ll be signed out in {seconds} {seconds === 1 ? "second" : "seconds"}. Anything you
            haven&apos;t saved will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={stay} autoFocus>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
