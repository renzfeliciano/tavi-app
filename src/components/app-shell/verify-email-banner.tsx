"use client";

import { useEffect, useState } from "react";
import { CheckIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/modules/identity/client";

/** Stops accidental repeat requests; the auth endpoint rate-limits regardless. */
const RESEND_COOLDOWN_S = 30;

type Outcome = { kind: "sent" } | { kind: "failed"; message: string } | null;

/**
 * Progressive verification (§D): everything works before verifying, but
 * sending to customers needs a confirmed email. It stays until the address is
 * confirmed. Resending goes through the rate-limited auth endpoint, and the
 * result is written next to the button (announced politely) rather than only
 * in a toast that can be missed.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (pending || cooldown > 0) return;
    setPending(true);
    setOutcome(null);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setPending(false);
    if (error) {
      setOutcome({ kind: "failed", message: authErrorMessage(error) });
    } else {
      setOutcome({ kind: "sent" });
      setCooldown(RESEND_COOLDOWN_S);
    }
  }

  return (
    <div
      role="region"
      aria-label="Email verification"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-info/25 bg-info-subtle px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <MailIcon aria-hidden="true" className="hidden size-4 shrink-0 text-info-strong sm:block" />
      <div className="min-w-0 flex-1 text-pretty text-info-strong">
        <p>
          Confirm <strong className="font-medium break-all">{email}</strong> before sending quotes to
          customers. We emailed you a link.
        </p>
        <p role="status" aria-live="polite" className="mt-1 text-xs empty:hidden">
          {outcome?.kind === "sent" && (
            <span className="inline-flex items-center gap-1">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              New link sent. Check your inbox, and spam if it&apos;s not there.
            </span>
          )}
          {outcome?.kind === "failed" && <span className="text-danger-strong">{outcome.message}</span>}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        pending={pending}
        pendingLabel="Sending…"
        disabled={cooldown > 0}
        onClick={resend}
        className="self-start sm:self-auto"
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : outcome?.kind === "failed" ? "Try again" : "Resend link"}
      </Button>
    </div>
  );
}
