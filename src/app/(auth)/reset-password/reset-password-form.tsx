"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleCheckIcon } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, networkFailure, PASSWORD_HINT, PASSWORD_POLICY } from "@/modules/identity/client";
import { type FieldErrors, type FieldRule, firstInvalid, validateFields } from "@/shared/validation/required";

const RULES: FieldRule[] = [
  {
    name: "password",
    required: "Choose a new password.",
    tooShort: { min: PASSWORD_POLICY.minLength, message: `Use at least ${PASSWORD_POLICY.minLength} characters.` },
  },
  {
    name: "confirm",
    required: "Type the new password again.",
    matches: { field: "password", message: "Those passwords don't match. Type the same password twice." },
  },
];

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const newPassword = String(form.get("password") ?? "");
    setError(null);
    const problems = validateFields({ password: newPassword, confirm: String(form.get("confirm") ?? "") }, RULES);
    setFieldErrors(problems);
    const first = firstInvalid(problems, RULES);
    if (first) {
      (element.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword, token }).catch(networkFailure);
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
      <FormField name="password" id="password" label="New password" hint={PASSWORD_HINT} error={fieldErrors.password}>
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
      <FormField name="confirm" id="confirm" label="Type it again" error={fieldErrors.confirm}>
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
      <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…">
        Save new password
      </Button>
    </form>
  );
}
