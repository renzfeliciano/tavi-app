"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MailCheckIcon } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, passwordResetLifetime } from "@/modules/identity/client";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    // Identical whether or not the account exists (no account enumeration).
    return (
      <div role="status" className="grid gap-4">
        <div className="flex gap-3 rounded-md border border-border bg-surface-sunken p-4 text-sm">
          <MailCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-stamp" />
          <p className="text-pretty">
            If there&apos;s a {brand.name} account for <strong className="font-medium">{sentTo}</strong>,
            we&apos;ve sent it a link to choose a new password. The link expires in {passwordResetLifetime()}.
          </p>
        </div>
        <Link href="/sign-in" className="text-center text-sm font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <FormAlert message={error} />
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="e.g. maria@acmeaircon.ph"
        />
      </Field>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Sending link…">
        Send reset link
      </Button>
      <Link
        href="/sign-in"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}
