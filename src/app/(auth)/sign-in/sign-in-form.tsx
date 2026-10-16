"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuthStage } from "@/components/auth-stage";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { brand } from "@/config/brand";
import { authClient } from "@/lib/auth-client";
import { markWelcome } from "@/lib/welcome-greeting";
import { authErrorMessage, networkFailure } from "@/modules/identity/client";
import { type FieldErrors, type FieldRule, firstInvalid, validateFields } from "@/shared/validation/required";

const RULES: FieldRule[] = [
  { name: "email", required: "Enter your email.", email: "Enter a valid email, like name@example.com." },
  { name: "password", required: "Enter your password." },
];

/** `next`: where to go after signing in (an invitation), else the dashboard. */
export function SignInForm({ next }: { next?: Route } = {}) {
  const router = useRouter();
  const { setStage } = useAuthStage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError(null);
    const problems = validateFields(
      { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") },
      RULES,
    );
    setFieldErrors(problems);
    const first = firstInvalid(problems, RULES);
    if (first) {
      // Nothing is sent; the Stamp looks concerned and the first field that needs fixing takes focus.
      setStage("error");
      (element.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    setStage("working");
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    }).catch(networkFailure);
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
      <FormField
        name="password"
        id="password"
        label="Password"
        error={fieldErrors.password}
        aside={
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        }
      >
        {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
      </FormField>
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
