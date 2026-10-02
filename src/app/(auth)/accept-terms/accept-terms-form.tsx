"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { LEGAL, LEGAL_PATHS } from "@/config/legal";
import { TERMS_REQUIRED_TO_CONTINUE } from "@/modules/identity/client";
import { acceptTermsAction } from "./actions";

export function AcceptTermsForm({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const termsRef = useRef<HTMLElement>(null);
  const termsId = useId();

  function submit() {
    setError(null);
    if (!agreed) {
      setTermsError(TERMS_REQUIRED_TO_CONTINUE);
      termsRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await acceptTermsAction(LEGAL.version);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormAlert message={error} />
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
              <Link
                href={LEGAL_PATHS.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Terms of Service<span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and have read the{" "}
              <Link
                href={LEGAL_PATHS.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Privacy Notice<span className="sr-only"> (opens in a new tab)</span>
              </Link>
              .
            </span>
          </label>
          {termsError && <FieldError id={`${termsId}-error`}>{termsError}</FieldError>}
        </Field>
        <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…">
          Agree and continue
        </Button>
      </form>
      <form action={signOutAction} className="text-center">
        <Button type="submit" variant="link">
          Sign out instead
        </Button>
      </form>
    </div>
  );
}
