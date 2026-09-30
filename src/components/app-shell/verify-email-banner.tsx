"use client";

import { useState } from "react";
import { MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/modules/identity/client";

/**
 * Progressive verification (§D): everything works before verifying, but
 * sending to customers needs a confirmed email. Resending goes through the
 * rate-limited auth endpoint.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setPending(false);
    if (error) toast.error(authErrorMessage(error));
    else toast.success("Verification link sent", { description: `Check ${email}.` });
  }

  return (
    <div
      role="region"
      aria-label="Email verification"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-info/25 bg-info-subtle px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <MailIcon aria-hidden="true" className="hidden size-4 shrink-0 text-info-strong sm:block" />
      <p className="flex-1 text-pretty text-info-strong">
        Confirm <strong className="font-medium">{email}</strong> before sending quotes to customers.
        We emailed you a link.
      </p>
      <Button variant="outline" size="sm" pending={pending} pendingLabel="Sending…" onClick={resend} className="self-start sm:self-auto">
        Resend link
      </Button>
    </div>
  );
}
