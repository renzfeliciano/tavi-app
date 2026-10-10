"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuthStage } from "@/components/auth-stage";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import { authClient } from "@/lib/auth-client";
import { markWelcome } from "@/lib/welcome-greeting";
import { authErrorMessage } from "@/modules/identity/client";

/** `next`: where to go after signing in (an invitation), else the dashboard. */
export function SignInForm({ next }: { next?: Route } = {}) {
  const router = useRouter();
  const { setStage } = useAuthStage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setStage("working");
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      setStage("error");
      return;
    }
    // A small nod while the dashboard (and its own skeleton) takes over; navigation never waits for it.
    setStage("success");
    markWelcome(window.sessionStorage);
    router.replace(next ?? "/dashboard");
    router.refresh();
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
      <Field>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Signing in…">
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to {brand.name}?{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
