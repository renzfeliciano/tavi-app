"use client";

import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RECURRENCE_LIMITS, type RecurrenceFrequency } from "@/modules/invoices/client";
import { eg } from "@/shared/text/example";

/** The fields that say when a bill repeats and for how long: shared by "Repeat this" and the schedule's edit page. */
export type RecurrenceValues = {
  frequency: RecurrenceFrequency;
  anchorDay: string;
  anchorMonth: string;
  startOn: string;
  endsOn: string;
  maxDrafts: string;
};

export const FREQUENCIES: { value: RecurrenceFrequency; label: string; phrase: string }[] = [
  { value: "weekly", label: "Every week", phrase: "every week" },
  { value: "monthly", label: "Every month", phrase: "every month" },
  { value: "quarterly", label: "Every 3 months", phrase: "every 3 months" },
  { value: "yearly", label: "Every year", phrase: "every year" },
];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

const dayOf = (date: string) => String(Number(date.slice(8, 10)) || 1);
const monthOf = (date: string) => String(Number(date.slice(5, 7)) || 1);

/** A monthly schedule on the start date's day, to change from. */
export function initialRecurrenceValues(startOn: string): RecurrenceValues {
  return { frequency: "monthly", anchorDay: dayOf(startOn), anchorMonth: monthOf(startOn), startOn, endsOn: "", maxDrafts: "" };
}

/** What the server action receives: a month only for a yearly schedule. */
export function recurrenceInput(values: RecurrenceValues) {
  return { ...values, anchorMonth: values.frequency === "yearly" ? values.anchorMonth : "" };
}

export const RECURRENCE_FIELD_NAMES = ["frequency", "anchorDay", "anchorMonth", "startOn", "endsOn", "maxDrafts"];

type Props = {
  values: RecurrenceValues;
  errors: Record<string, string>;
  onChange: (next: RecurrenceValues) => void;
  startLabel?: string;
};

export function RecurrenceFields({ values, errors, onChange, startLabel = "Starts on" }: Props) {
  const { frequency } = values;
  const set = (patch: Partial<RecurrenceValues>) => onChange({ ...values, ...patch });
  return (
    <>
      <FormField name="frequency" id="repeat-frequency" label="How often" error={errors.frequency}>
        {(control) => (
          <NativeSelect
            {...control}
            value={frequency}
            onChange={(event) => {
              const next = event.target.value as RecurrenceFrequency;
              // A weekday number (1–7) means something else than a day of the month, so the day resets.
              set({ frequency: next, anchorDay: next === "weekly" ? "1" : dayOf(values.startOn) });
            }}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="anchorDay" id="repeat-day" label="Day" error={errors.anchorDay}>
          {(control) => (
            <NativeSelect {...control} value={values.anchorDay} onChange={(event) => set({ anchorDay: event.target.value })}>
              {frequency === "weekly"
                ? WEEKDAYS.map((name, index) => (
                    <option key={name} value={String(index + 1)}>
                      {name}
                    </option>
                  ))
                : Array.from({ length: 31 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)}>
                      {ordinal(index + 1)}
                    </option>
                  ))}
            </NativeSelect>
          )}
        </FormField>
        {frequency === "yearly" && (
          <FormField name="anchorMonth" id="repeat-month" label="Month" error={errors.anchorMonth}>
            {(control) => (
              <NativeSelect {...control} value={values.anchorMonth} onChange={(event) => set({ anchorMonth: event.target.value })}>
                {MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1)}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </div>
      {frequency !== "weekly" && Number(values.anchorDay) > 28 && (
        <p className="-mt-2 text-sm text-muted-foreground">In shorter months it runs on the last day.</p>
      )}
      <FormField name="startOn" id="repeat-start" label={startLabel} error={errors.startOn}>
        {(control) => <Input {...control} type="date" value={values.startOn} onChange={(event) => set({ startOn: event.target.value })} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="endsOn" id="repeat-end" label="Ends on" optional error={errors.endsOn}>
          {(control) => <Input {...control} type="date" value={values.endsOn} onChange={(event) => set({ endsOn: event.target.value })} />}
        </FormField>
        <FormField name="maxDrafts" id="repeat-count" label="Number of statements" optional error={errors.maxDrafts}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={values.maxDrafts}
              onChange={(event) => set({ maxDrafts: event.target.value })}
              placeholder={eg("12")}
              maxLength={String(RECURRENCE_LIMITS.maxDraftsMax).length}
            />
          )}
        </FormField>
      </div>
    </>
  );
}
