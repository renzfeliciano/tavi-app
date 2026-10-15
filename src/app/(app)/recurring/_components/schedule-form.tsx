"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_LIMITS } from "@/modules/documents/client";
import { eg } from "@/shared/text/example";
import { RECURRENCE_FIELD_NAMES, RecurrenceFields, type RecurrenceValues, recurrenceInput } from "./recurrence-fields";

type UpdateResult = { ok: true } | { ok: false; errors: Record<string, string> };

type ScheduleFormProps = {
  id: string;
  initial: { recurrence: RecurrenceValues; termsDays: string; notes: string; terms: string };
  /** The server action, bound to this schedule by the page. */
  update: (input: unknown) => Promise<UpdateResult>;
};

const FIELD_NAMES = [...RECURRENCE_FIELD_NAMES, "termsDays", "notes", "terms"];

/**
 * The schedule's edit page (spec 4): when it repeats, for how long, and the payment terms and notes of the
 * statements still to come. The items stay as they were when the schedule was made.
 */
export function ScheduleForm({ id, initial, update }: ScheduleFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [termsDays, setTermsDays] = useState(initial.termsDays);
  const [notes, setNotes] = useState(initial.notes);
  const [terms, setTerms] = useState(initial.terms);

  async function submit() {
    setPending(true);
    setErrors({});
    const result = await update({ ...recurrenceInput(recurrence), termsDays, notes, terms });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast.success("Schedule updated. It applies to the next statement onward.");
    router.push(`/recurring/${id}`);
    router.refresh();
  }

  const formLevel = Object.entries(errors).find(([key]) => !FIELD_NAMES.includes(key))?.[1];

  return (
    <form
      noValidate
      className="grid gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormAlert message={formLevel} />
      <FormSection title="When it repeats" description="Applies to the next statement onward.">
        <div className="grid gap-4 sm:col-span-2">
          <RecurrenceFields
            values={recurrence}
            errors={errors}
            onChange={(next) => {
              setRecurrence(next);
              setErrors({});
            }}
            startLabel="Next statement on"
          />
        </div>
      </FormSection>
      <FormSection title="Payment and notes" description="Added to each statement made from now on.">
        <FormField name="termsDays" id="schedule-terms-days" label="Days to pay" error={errors.termsDays} hint="Days after it is made. 0 means due at once.">
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={termsDays}
              onChange={(event) => setTermsDays(event.target.value)}
              placeholder={eg("7")}
              maxLength={3}
            />
          )}
        </FormField>
        <FormField name="notes" id="schedule-notes" label="Notes" optional error={errors.notes} className="sm:col-span-2">
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={DOCUMENT_LIMITS.notes}
              placeholder={eg("Thank you for your business.")}
            />
          )}
        </FormField>
        <FormField name="terms" id="schedule-terms" label="Terms" optional error={errors.terms} className="sm:col-span-2">
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              maxLength={DOCUMENT_LIMITS.terms}
              placeholder={eg("Payment by bank transfer within the days above.")}
            />
          )}
        </FormField>
      </FormSection>
      <div className="flex justify-end">
        <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…" className="w-full sm:w-auto">
          Save changes
        </Button>
      </div>
    </form>
  );
}
