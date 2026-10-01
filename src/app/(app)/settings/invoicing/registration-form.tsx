"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { INVOICE_REGISTRATION_LIMITS } from "@/modules/invoices/client";
import { type RegistrationFormState, type RegistrationValues, saveRegistrationAction, turnOffRegistrationAction } from "./actions";

type RegistrationFormProps = {
  editable: boolean;
  active: boolean;
  labels: { number: string; numberHint: string; date: string; seriesHint: string };
  titles: readonly string[];
  /** The market's name for unregistered bills, plural (PH: "billing statements"). */
  statementName: string;
  initial: RegistrationValues;
};

export function RegistrationForm({ editable, active, labels, titles, statementName, initial }: RegistrationFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<RegistrationFormState, FormData>(saveRegistrationAction, {});
  const [confirmOff, setConfirmOff] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const values = state.values ?? initial;
  const error = (field: keyof RegistrationValues) => state.errors?.[field];

  useEffect(() => {
    if (state.savedAt) toast.success(`Invoice registration saved. New bills are issued as “${state.values?.title}”.`);
  }, [state.savedAt, state.values?.title]);

  async function turnOff() {
    setTurningOff(true);
    const result = await turnOffRegistrationAction();
    setTurningOff(false);
    setConfirmOff(false);
    if (result.ok) {
      toast.success(`Invoice mode is off. New bills are ${statementName} again.`);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <section aria-labelledby="registration-heading" className="rounded-xl border border-border bg-card shadow-xs">
      <form action={formAction} noValidate key={state.savedAt ?? "initial"}>
        <header className="border-b border-border px-5 py-4 sm:px-6">
          <h2 id="registration-heading" className="font-semibold">
            Registration details
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">As on the certificate your RDO issued.</p>
        </header>
        <fieldset disabled={!editable} className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <legend className="sr-only">Registration details</legend>
          <div className="sm:col-span-2">
            <FormAlert message={state.error} />
          </div>
          <FormField name="number" label={labels.number} hint={labels.numberHint} error={error("number")} className="sm:col-span-2">
            {(p) => (
              <Input {...p} defaultValue={values.number} maxLength={INVOICE_REGISTRATION_LIMITS.number} spellCheck={false} className="font-mono" />
            )}
          </FormField>
          <FormField name="issuedOn" label={labels.date} error={error("issuedOn")}>
            {(p) => <Input {...p} type="date" defaultValue={values.issuedOn} />}
          </FormField>
          <FormField name="title" label="Title on your bills" error={error("title")}>
            {(p) => (
              <NativeSelect {...p} defaultValue={values.title}>
                {titles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField name="seriesStart" label="First serial number" hint={labels.seriesHint} error={error("seriesStart")}>
            {(p) => (
              <Input {...p} defaultValue={values.seriesStart} inputMode="numeric" maxLength={INVOICE_REGISTRATION_LIMITS.serialDigits} className="font-mono" />
            )}
          </FormField>
          <FormField name="seriesEnd" label="Last serial number" error={error("seriesEnd")}>
            {(p) => (
              <Input {...p} defaultValue={values.seriesEnd} inputMode="numeric" maxLength={INVOICE_REGISTRATION_LIMITS.serialDigits} className="font-mono" />
            )}
          </FormField>
          {editable && (
            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              {active && (
                <Button type="button" variant="outline" onClick={() => setConfirmOff(true)}>
                  Turn off invoice mode
                </Button>
              )}
              <Button type="submit" pending={pending} pendingLabel="Saving…">
                {active ? "Save changes" : "Save and turn on invoice mode"}
              </Button>
            </div>
          )}
        </fieldset>
      </form>

      <Dialog open={confirmOff} onOpenChange={setConfirmOff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off invoice mode?</DialogTitle>
            <DialogDescription>
              New bills will be {statementName}, which aren&apos;t invoices for tax. Invoices you already sent don&apos;t
              change, and turning it back on continues your serial numbers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep it on</DialogClose>
            <Button type="button" variant="destructive" pending={turningOff} pendingLabel="Turning off…" onClick={() => void turnOff()}>
              Turn off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
