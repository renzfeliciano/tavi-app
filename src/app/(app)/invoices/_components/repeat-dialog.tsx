"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RepeatIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { firstRunOn, parseRecurrence } from "@/modules/invoices/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import {
  FREQUENCIES,
  initialRecurrenceValues,
  RECURRENCE_FIELD_NAMES,
  RecurrenceFields,
  recurrenceInput,
} from "../../recurring/_components/recurrence-fields";

type CreateResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

type RepeatDialogProps = {
  /** The server action, bound to the bill it repeats. */
  create: (input: unknown) => Promise<CreateResult>;
  defaults: { startOn: string };
  locale: string;
};

/**
 * "Repeat this" on an issued bill (spec 3): how often, on which day, from when, and an optional end.
 * It sets up the schedule; the statements themselves are drafts made on each due date.
 */
export function RepeatDialog({ create, defaults, locale }: RepeatDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState(() => initialRecurrenceValues(defaults.startOn));

  async function submit() {
    setPending(true);
    setErrors({});
    const input = recurrenceInput(values);
    const result = await create(input);
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // The first statement is on the first due date on or after the start date, which may be a few days later.
    const parsed = parseRecurrence(input, { today: values.startOn });
    const first = parsed.ok ? firstRunOn(parsed.rule, values.startOn) : values.startOn;
    const phrase = FREQUENCIES.find((f) => f.value === values.frequency)?.phrase ?? "";
    setOpen(false);
    toast.success(`Repeating ${phrase} from ${formatCalendarDate(first, locale)}.`, {
      action: { label: "View schedule", onClick: () => router.push(`/recurring/${result.id}`) },
    });
    router.refresh();
  }

  const formLevel = Object.entries(errors).find(([key]) => !RECURRENCE_FIELD_NAMES.includes(key))?.[1];

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <RepeatIcon aria-hidden="true" />
        Repeat this
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Repeat this statement</DialogTitle>
            <DialogDescription>
              On each due date a new draft is made from these items, for you to check and send. Nothing is sent by itself.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <FormAlert message={formLevel} />
            <RecurrenceFields
              values={values}
              errors={errors}
              onChange={(next) => {
                setValues(next);
                setErrors({});
              }}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
            <Button type="submit" pending={pending} pendingLabel="Setting up…">
              Start repeating
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
