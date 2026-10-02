"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LEGAL, LEGAL_PATHS } from "@/config/legal";
import { authClient } from "@/lib/auth-client";
import {
  authErrorMessage,
  PASSWORD_HINT,
  PASSWORD_POLICY,
  TERMS_REQUIRED_MESSAGE,
} from "@/modules/identity/client";

/** `next`: where to go after creating the account (an invitation), else onboarding. */
export function SignUpForm({ next }: { next?: Route } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const termsRef = useRef<HTMLElement>(null);
  const termsId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    if (!agreed) {
      setTermsError(TERMS_REQUIRED_MESSAGE);
      termsRef.current?.focus();
      return;
    }
    setPending(true);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      // The version on this page; the server refuses anything but the current one.
      termsVersion: LEGAL.version,
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next ?? "/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <FormAlert message={error} />
      <Field>
        <FieldLabel htmlFor="name">Your name</FieldLabel>
        <Input id="name" name="name" autoComplete="name" required maxLength={120} placeholder="e.g. Maria Santos" />
      </Field>
      <Field>
        <FieldLabel htmlFor="email">Work email</FieldLabel>
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
        <FieldLabel htmlFor="password">Password</FieldLabel>
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
      <Field data-invalid={termsError ? "true" : undefined}>
        <label htmlFor={termsId} className="flex items-start gap-2.5 text-sm text-pretty">
          <Checkbox
            ref={termsRef}
            id={termsId}
            checked={agreed}
            onCheckedChange={(checked) => {
              setAgreed(checked === true);
              if (checked === true) setTermsError(null);
            }}
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? `${termsId}-error` : undefined}
            // Named by its text directly: the <label> points at Base UI's hidden
            // input, and Field only links the visible checkbox after hydration.
            aria-labelledby={`${termsId}-label`}
            className="mt-0.5"
          />
          <span id={`${termsId}-label`}>
            I agree to the{" "}
            <LegalLink href={LEGAL_PATHS.terms}>Terms of Service</LegalLink> and have read the{" "}
            <LegalLink href={LEGAL_PATHS.privacy}>Privacy Notice</LegalLink>.
          </span>
        </label>
        {termsError && <FieldError id={`${termsId}-error`}>{termsError}</FieldError>}
      </Field>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Creating account…">
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Opens in a new tab, so what's typed in the form stays put. */
function LegalLink({ href, children }: { href: Route; children: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}
