"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleCheckIcon } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, PASSWORD_HINT, PASSWORD_POLICY } from "@/modules/identity/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setError("Those passwords don't match. Type the same password twice.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="grid gap-4">
        <div className="flex gap-3 rounded-md border border-success/25 bg-success-subtle p-4 text-sm text-success-strong">
          <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="text-pretty">
            Password updated. For your security, we signed you out on every device.
          </p>
        </div>
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <FormAlert message={error} />
      <Field>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_POLICY.minLength}
          maxLength={PASSWORD_POLICY.maxLength}
          aria-describedby="password-hint"
        />
        <FieldDescription id="password-hint">{PASSWORD_HINT}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="confirm">Type it again</FieldLabel>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required minLength={PASSWORD_POLICY.minLength} maxLength={PASSWORD_POLICY.maxLength} />
      </Field>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…">
        Save new password
      </Button>
    </form>
  );
}
