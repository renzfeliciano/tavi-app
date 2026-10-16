"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { LEGAL, LEGAL_PATHS } from "@/config/legal";
import { authClient } from "@/lib/auth-client";
import {
  authErrorMessage,
  networkFailure,
  PASSWORD_HINT,
  PASSWORD_POLICY,
  TERMS_REQUIRED_MESSAGE,
} from "@/modules/identity/client";
import { type FieldErrors, type FieldRule, firstInvalid, validateFields } from "@/shared/validation/required";

const RULES: FieldRule[] = [
  { name: "name", required: "Enter your name." },
  { name: "email", required: "Enter your email.", email: "Enter a valid email, like name@example.com." },
  {
    name: "password",
    required: "Choose a password.",
    tooShort: { min: PASSWORD_POLICY.minLength, message: `Use at least ${PASSWORD_POLICY.minLength} characters.` },
  },
];

/** `next`: where to go after creating the account (an invitation), else onboarding. */
export function SignUpForm({ next }: { next?: Route } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const termsRef = useRef<HTMLElement>(null);
  const termsId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError(null);
    const problems = validateFields(
      {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      },
      RULES,
    );
    setFieldErrors(problems);
    setTermsError(agreed ? null : TERMS_REQUIRED_MESSAGE);
    // Everything that needs fixing shows at once; the first one, top to bottom, takes focus.
    const first = firstInvalid(problems, RULES);
    if (first) {
      (element.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    if (!agreed) {
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
    }).catch(networkFailure);
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next ?? "/onboarding");
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
      {(Object.keys(fieldErrors).length > 0 || termsError) && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      <FormField name="name" id="name" label="Your name" error={fieldErrors.name}>
        {(p) => <Input {...p} autoComplete="name" required maxLength={120} placeholder="e.g. Renzo Feliciano Payod" />}
      </FormField>
      <FormField name="email" id="email" label="Work email" error={fieldErrors.email}>
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
      <FormField name="password" id="password" label="Password" hint={PASSWORD_HINT} error={fieldErrors.password}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="new-password"
            required
            minLength={PASSWORD_POLICY.minLength}
            maxLength={PASSWORD_POLICY.maxLength}
          />
        )}
      </FormField>
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
