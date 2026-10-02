"use client";

import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { closeAccountAction } from "./actions";

/** Closing an account can't be undone, so it asks first and needs the password (D16). */
export function CloseAccountDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const passwordId = useId();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword("");
      setPasswordError(null);
      setFormError(null);
    }
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Close account
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPasswordError(null);
              setFormError(null);
              if (!password) {
                setPasswordError("Enter your password.");
                return;
              }
              startTransition(async () => {
                // On success the action redirects to /account-closed.
                const result = await closeAccountAction(password);
                if (result.field === "password") setPasswordError(result.error);
                else setFormError(result.error);
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Close your account?</DialogTitle>
              <DialogDescription>This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <ul className="grid list-disc gap-1.5 pl-5 text-sm text-pretty marker:text-muted-foreground">
              <li>You&apos;ll be signed out everywhere, and your password will stop working.</li>
              <li>Your name and email will be removed.</li>
              <li>
                A business only you use closes: its customer links stop working, and the documents and payments it
                issued are kept as tax rules require.
              </li>
              <li>You leave any business you share with others.</li>
            </ul>
            <FormAlert message={formError} />
            <Field data-invalid={passwordError ? "true" : undefined}>
              <FieldLabel htmlFor={passwordId}>Your password</FieldLabel>
              <PasswordInput
                id={passwordId}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? `${passwordId}-error` : undefined}
              />
              {passwordError && <FieldError id={`${passwordId}-error`}>{passwordError}</FieldError>}
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep my account</DialogClose>
              <Button type="submit" variant="destructive" pending={pending} pendingLabel="Closing…">
                Close my account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
