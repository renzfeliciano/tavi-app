"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { DocumentNumber } from "@/components/document-number";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDocumentNumber, NUMBERING_LIMITS } from "@/modules/documents/client";
import { type NumberingFormState, saveNumbering } from "./actions";

const { prefixMaxLength, padding: PADDING } = NUMBERING_LIMITS;
const PADDINGS = Array.from({ length: PADDING.max - PADDING.min + 1 }, (_, i) => PADDING.min + i);

type NumberingFormProps = {
  kind: string;
  title: string;
  description: string;
  prefix: string;
  padding: number;
  nextValue: number;
  editable: boolean;
};

export function NumberingForm({ kind, title, description, prefix, padding, nextValue, editable }: NumberingFormProps) {
  const [state, formAction, pending] = useActionState<NumberingFormState, FormData>(saveNumbering, {});
  const [draft, setDraft] = useState({ prefix, padding });
  const preview = formatDocumentNumber(
    { prefix: draft.prefix.trim().toUpperCase(), padding: draft.padding },
    nextValue,
  );
  const changed = draft.prefix.trim().toUpperCase() !== prefix || draft.padding !== padding;
  const headingId = `numbering-${kind}`;

  useEffect(() => {
    if (state.savedAt) toast.success(`${title} numbering saved.`);
  }, [state.savedAt, title]);

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-card shadow-xs">
      <form action={formAction} noValidate>
        <input type="hidden" name="kind" value={kind} />
        <header className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="grid gap-0.5">
            <h2 id={headingId} className="font-semibold">
              {title}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">{description}</p>
          </div>
          <p className="text-sm text-muted-foreground sm:text-right">
            Next: <DocumentNumber number={preview} className="text-base" />
          </p>
        </header>
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          <FormAlert message={state.error} />
          <fieldset disabled={!editable} className="flex min-w-0 flex-wrap items-start gap-4">
            <legend className="sr-only">{title} number format</legend>
            <FormField
              name="prefix"
              id={`prefix-${kind}`}
              label="Prefix"
              hint="Letters, digits or dashes. Can be empty."
              error={state.fieldErrors?.prefix?.[0]}
              className="w-full sm:w-64"
            >
              {(p) => (
                <Input
                  {...p}
                  value={draft.prefix}
                  onChange={(e) => setDraft((d) => ({ ...d, prefix: e.target.value }))}
                  maxLength={prefixMaxLength}
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="font-mono uppercase"
                />
              )}
            </FormField>
            <FormField
              name="padding"
              id={`padding-${kind}`}
              label="Digits"
              error={state.fieldErrors?.padding?.[0]}
              className="w-24"
            >
              {(p) => (
                <NativeSelect
                  {...p}
                  value={draft.padding}
                  onChange={(e) => setDraft((d) => ({ ...d, padding: Number(e.target.value) }))}
                  className="font-mono"
                >
                  {PADDINGS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {editable && (
              <Button
                type="submit"
                variant="outline"
                disabled={!changed}
                pending={pending}
                pendingLabel="Saving…"
                className="w-full sm:mt-6 sm:ml-auto sm:w-auto"
              >
                Save
              </Button>
            )}
          </fieldset>
        </div>
      </form>
    </section>
  );
}
