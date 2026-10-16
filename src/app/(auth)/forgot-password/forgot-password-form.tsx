"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MailCheckIcon } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, networkFailure, passwordResetLifetime } from "@/modules/identity/client";
import { type FieldErrors, type FieldRule, firstInvalid, validateFields } from "@/shared/validation/required";

const RULES: FieldRule[] = [
  { name: "email", required: "Enter your email.", email: "Enter a valid email, like name@example.com." },
];

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const email = String(new FormData(element).get("email") ?? "").trim();
    setError(null);
    const problems = validateFields({ email }, RULES);
    setFieldErrors(problems);
    const first = firstInvalid(problems, RULES);
    if (first) {
      (element.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    }).catch(networkFailure);
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
    <form
      method="post"
      noValidate
      onSubmit={onSubmit}
      onChange={(event) => {
        // A problem goes away as soon as the person starts fixing it.
        const name = (event.target as unknown as { name?: string }).name ?? "";
        setFieldErrors((current) => {
          if (!current[name]) return current;
          const rest = { ...current };
          delete rest[name];
          return rest;
        });
      }}
      className="grid gap-5"
    >
      <FormAlert message={error} />
      {Object.keys(fieldErrors).length > 0 && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      <FormField name="email" id="email" label="Email" error={fieldErrors.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="e.g. renzofelicianopayod.repairservices@gmail.com"
          />
        )}
      </FormField>
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
