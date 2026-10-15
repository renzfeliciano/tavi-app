"use client";

import { useId, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_ACK_RECIPIENTS } from "@/modules/payments/client";
import { addRecipient } from "../_lib/recipients";

/** The state behind a RecipientsField. `fixed` are addresses counted already (the customer's). */
export function useRecipients(fixed: readonly string[]) {
  const [extras, setExtras] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Adds the typed address; returns the new list, or null when it isn't acceptable (the error is shown). */
  function add(): string[] | null {
    const result = addRecipient(draft, extras, fixed);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setExtras(result.extras);
    setDraft("");
    setError(null);
    return result.extras;
  }

  return {
    extras,
    draft,
    error,
    setError,
    add,
    remove: (email: string) => setExtras((current) => current.filter((x) => x !== email)),
    type: (value: string) => {
      setDraft(value);
      setError(null);
    },
  };
}

export type Recipients = ReturnType<typeof useRecipients>;

/** Extra addresses a receipt is sent to: type one, press Enter or Add, remove it with its chip. */
export function RecipientsField({ recipients, label }: { recipients: Recipients; label: string }) {
  const id = useId();
  const { extras, draft, error } = recipients;
  return (
    <div className="grid gap-2">
      {extras.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Also sending to">
          {extras.map((email) => (
            <li key={email} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-3 text-sm">
              <span className="truncate">{email}</span>
              <button
                type="button"
                aria-label={`Remove ${email}`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:size-8"
                onClick={() => recipients.remove(email)}
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-recipient`} className="text-sm text-muted-foreground">
          {label} <span className="font-normal">(up to {MAX_ACK_RECIPIENTS} people)</span>
        </label>
        <div className="flex gap-2">
          <Input
            id={`${id}-recipient`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-recipient-error` : undefined}
            onChange={(e) => recipients.type(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault(); // Enter adds the address; it doesn't submit the form
                recipients.add();
              }
            }}
          />
          <Button type="button" variant="outline" disabled={!draft.trim()} onClick={() => void recipients.add()}>
            Add
          </Button>
        </div>
        {error && (
          <p id={`${id}-recipient-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
