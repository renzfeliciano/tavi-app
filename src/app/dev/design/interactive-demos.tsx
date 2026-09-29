"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { Button } from "@/components/ui/button";

/** Toasts for the micro-interaction moments in §32. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Quote sent")}>
        Quote sent
      </Button>
      <Button variant="outline" onClick={() => toast.success("Payment recorded")}>
        Payment recorded
      </Button>
      <Button variant="outline" onClick={() => toast("Link copied")}>
        Link copied
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("We couldn't send the quote.", {
            description: "Your quote was not lost. Try again.",
          })
        }
      >
        Send failed
      </Button>
    </div>
  );
}

/** The pending state: spinner with present-tense text, disabled while busy. */
export function PendingDemo() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      pending={pending}
      pendingLabel="Sending…"
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), 1600);
      }}
    >
      Send quote
    </Button>
  );
}

/** Replays the Stamp's paid moment (press, then imprint). */
export function StampMomentDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div key={run} className="flex items-center gap-6">
        <BrandMascot expression="celebrating" size="lg" animated />
        <StampImprint label="Paid" date="30 Sep 2026" animated />
      </div>
      <Button variant="outline" onClick={() => setRun((n) => n + 1)}>
        Replay
      </Button>
    </div>
  );
}
