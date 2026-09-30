"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CurrencyOption } from "@/config/currencies";
import { BUSINESS_PROFILE_LIMITS } from "@/modules/organizations/client";
import { createBusiness, type CreateBusinessState } from "./actions";

type BusinessFormProps = {
  /** The default market's currency first. */
  currencies: CurrencyOption[];
  countries: { code: string; name: string }[];
  defaultCountry: string;
};

export function BusinessForm({ currencies, countries, defaultCountry }: BusinessFormProps) {
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
          maxLength={BUSINESS_PROFILE_LIMITS.name}
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
          defaultValue={state.values?.currency ?? currencies[0]?.code}
          aria-invalid={errors.currency ? true : undefined}
          aria-describedby={errors.currency ? "currency-error" : "currency-hint"}
        >
          {currencies.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
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
      {countries.length > 1 ? (
        <Field data-invalid={errors.country ? "true" : undefined}>
          <FieldLabel htmlFor="country">Country</FieldLabel>
          <NativeSelect
            id="country"
            name="country"
            defaultValue={state.values?.country ?? defaultCountry}
            aria-invalid={errors.country ? true : undefined}
            aria-describedby={errors.country ? "country-error" : undefined}
          >
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </NativeSelect>
          {errors.country && <FieldError id="country-error">{errors.country[0]}</FieldError>}
        </Field>
      ) : (
        // One market so far: its tax, address and document rules apply.
        <input type="hidden" name="country" value={defaultCountry} />
      )}
      <Button type="submit" size="lg" pending={pending} pendingLabel="Setting up…">
        Continue
      </Button>
    </form>
  );
}
