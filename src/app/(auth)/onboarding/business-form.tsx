"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { CURRENCIES } from "@/config/currencies";
import { createBusiness, type CreateBusinessState } from "./actions";

export function BusinessForm() {
  const [state, formAction, pending] = useActionState<CreateBusinessState, FormData>(createBusiness, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form key={state.submission} action={formAction} className="grid gap-5">
      <Field data-invalid={errors.name ? "true" : undefined}>
        <FieldLabel htmlFor="name">Business name</FieldLabel>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          autoComplete="organization"
          defaultValue={state.values?.name}
          placeholder="e.g. Dela Cruz Aircon Services"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : "name-hint"}
        />
        {errors.name ? (
          <FieldError id="name-error">{errors.name[0]}</FieldError>
        ) : (
          <FieldDescription id="name-hint">As it should appear on your quotes and invoices.</FieldDescription>
        )}
      </Field>
      <Field data-invalid={errors.currency ? "true" : undefined}>
        <FieldLabel htmlFor="currency">Currency</FieldLabel>
        <NativeSelect
          id="currency"
          name="currency"
          defaultValue={state.values?.currency ?? "PHP"}
          aria-invalid={errors.currency ? true : undefined}
          aria-describedby={errors.currency ? "currency-error" : "currency-hint"}
        >
          {CURRENCIES.map(([code, label]) => (
            <option key={code} value={code}>
              {code} · {label}
            </option>
          ))}
        </NativeSelect>
        {errors.currency ? (
          <FieldError id="currency-error">{errors.currency[0]}</FieldError>
        ) : (
          <FieldDescription id="currency-hint">
            Used for new quotes and invoices. You can bill a customer in another currency later.
          </FieldDescription>
        )}
      </Field>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Setting up…">
        Continue
      </Button>
    </form>
  );
}
