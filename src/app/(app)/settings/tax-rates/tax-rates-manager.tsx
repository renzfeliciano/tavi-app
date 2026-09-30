"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MoreHorizontalIcon, PercentIcon, PlusIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TAX_RATE_LIMITS } from "@/modules/catalog/client";
import {
  archiveTaxRateAction,
  makeDefaultTaxRate,
  restoreTaxRateAction,
  saveTaxRate,
  type TaxRateCommandResult,
  type TaxRateFormState,
} from "./actions";

export type TaxRateRow = {
  id: string;
  name: string;
  /** Display form, e.g. "12.5%". */
  rate: string;
  /** Edit form, e.g. "12.5". */
  rateInput: string;
  isDefault: boolean;
  archived: boolean;
};

/** A tax the business's market commonly charges, offered as a preset. */
export type TaxSuggestion = { name: string; rate: string; rateInput: string };

type Editing = { mode: "create"; preset?: { name: string; rate: string } } | { mode: "edit"; row: TaxRateRow };

export function TaxRatesManager({
  rates,
  suggestions,
  editable,
}: {
  rates: TaxRateRow[];
  suggestions: TaxSuggestion[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, startTransition] = useTransition();
  const active = rates.filter((r) => !r.archived);
  const archived = rates.filter((r) => r.archived);
  const hasDefault = active.some((r) => r.isDefault);

  function run(command: () => Promise<TaxRateCommandResult>, success: string) {
    startTransition(async () => {
      const result = await command();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  return (
    <div className="mt-8 grid max-w-3xl gap-8">
      {active.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <EmptyState
            title="No taxes yet"
            description={
              suggestions[0]
                ? `Registered for ${suggestions[0].name}? Add it at ${suggestions[0].rate} and it's applied to new lines. Not registered? Leave this empty and your documents won't show tax.`
                : "Add the taxes you charge and they're applied to new lines. If you don't charge tax, leave this empty."
            }
            action={
              editable && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.name}
                      onClick={() =>
                        setEditing({ mode: "create", preset: { name: suggestion.name, rate: suggestion.rateInput } })
                      }
                    >
                      Add {suggestion.name} ({suggestion.rate})
                    </Button>
                  ))}
                  <Button
                    variant={suggestions.length > 0 ? "outline" : "default"}
                    onClick={() => setEditing({ mode: "create" })}
                  >
                    {suggestions.length > 0 ? "Add another tax" : "Add a tax"}
                  </Button>
                </div>
              )
            }
          />
        </div>
      ) : (
        <section aria-labelledby="active-heading" className="grid gap-3">
          <div className="flex items-end justify-between gap-4">
            <h2 id="active-heading" className="font-semibold">
              In use
            </h2>
            {editable && (
              <Button variant="outline" onClick={() => setEditing({ mode: "create" })}>
                <PlusIcon aria-hidden="true" />
                Add tax
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {active.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <PercentIcon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">{row.rate}</span>
                  {row.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-stamp/30 bg-stamp-subtle px-2 py-0.5 text-xs font-medium text-stamp">
                      <StarIcon aria-hidden="true" className="size-3" />
                      Default
                    </span>
                  )}
                </div>
                {editable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`} />}
                      disabled={pending}
                    >
                      <MoreHorizontalIcon aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => setEditing({ mode: "edit", row })}>Edit</DropdownMenuItem>
                      {row.isDefault ? (
                        <DropdownMenuItem
                          onClick={() => run(() => makeDefaultTaxRate(null), "New lines start with no tax.")}
                        >
                          Stop using as default
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => run(() => makeDefaultTaxRate(row.id), `${row.name} is now the default.`)}
                        >
                          Make default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => run(() => archiveTaxRateAction(row.id), `${row.name} archived.`)}
                      >
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-pretty text-muted-foreground">
            {hasDefault
              ? "The default is added to new lines; you can change it on any line. Documents already sent keep the rate they were sent with."
              : "No default: new lines start without tax. Documents already sent keep the rate they were sent with."}
          </p>
        </section>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived-heading" className="grid gap-3">
          <h2 id="archived-heading" className="font-semibold">
            Archived
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {archived.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3 text-muted-foreground sm:px-6">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
                  <span className="truncate">{row.name}</span>
                  <span className="font-mono text-sm tabular-nums">{row.rate}</span>
                </div>
                {editable && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => restoreTaxRateAction(row.id), `${row.name} restored.`)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaxRateDialog
        editing={editing}
        example={suggestions[0] ?? null}
        isFirst={active.length === 0}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function TaxRateDialog({
  editing,
  example,
  isFirst,
  onClose,
}: {
  editing: Editing | null;
  example: TaxSuggestion | null;
  isFirst: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {editing && (
          // Keyed so each opening starts with a fresh form state.
          <TaxRateForm
            key={editing.mode === "edit" ? editing.row.id : `new-${editing.preset?.name ?? ""}`}
            editing={editing}
            example={example}
            isFirst={isFirst}
            onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaxRateForm({
  editing,
  example,
  isFirst,
  onSaved,
}: {
  editing: Editing;
  example: TaxSuggestion | null;
  isFirst: boolean;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<TaxRateFormState, FormData>(saveTaxRate, {});
  const initial =
    editing.mode === "edit"
      ? { name: editing.row.name, rate: editing.row.rateInput }
      : (editing.preset ?? { name: "", rate: "" });
  const values = state.values ?? initial;

  useEffect(() => {
    if (!state.savedAt) return;
    toast.success(editing.mode === "edit" ? "Tax rate saved." : `${values.name || "Tax"} added.`);
    onSaved();
  }, [state.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing.mode === "edit" ? `Edit ${editing.row.name}` : "Add a tax"}</DialogTitle>
        <DialogDescription>
          {editing.mode === "edit"
            ? "Changes apply to new lines. Documents already sent keep their rate."
            : example
              ? `For example ${example.name} at ${example.rate}, or a local tax your business charges.`
              : "A tax your business charges, such as a sales or local business tax."}
        </DialogDescription>
      </DialogHeader>
      <FormAlert message={state.error} />
      {editing.mode === "edit" && <input type="hidden" name="id" value={editing.row.id} />}
      <div key={state.submission} className="grid gap-4">
        <FormField name="name" label="Name" hint={example ? `Shown on documents, e.g. ${example.name}.` : "Shown on documents."} error={state.fieldErrors?.name?.[0]}>
          {(p) => <Input {...p} defaultValue={values.name} maxLength={TAX_RATE_LIMITS.name} autoFocus />}
        </FormField>
        <FormField name="rate" label="Rate" error={state.fieldErrors?.rate?.[0]}>
          {(p) => (
            <div className="flex items-center gap-2">
              <Input
                {...p}
                defaultValue={values.rate}
                inputMode="decimal"
                maxLength={TAX_RATE_LIMITS.rateInput}
                className="w-28 font-mono tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </FormField>
        {editing.mode === "create" && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="makeDefault"
              defaultChecked={isFirst}
              className="mt-0.5 size-4 accent-stamp"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">Add it to new lines by default</span>
              <span className="text-muted-foreground">You can still change the tax on any line.</span>
            </span>
          </label>
        )}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          {editing.mode === "edit" ? "Save" : "Add tax"}
        </Button>
      </DialogFooter>
    </form>
  );
}
