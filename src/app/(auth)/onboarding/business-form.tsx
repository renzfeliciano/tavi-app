"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { CategoryIcon } from "@/components/category-icon";
import { CATEGORIES, CATEGORY_CODES } from "@/config/categories";
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
      <fieldset className="grid gap-2" aria-describedby={errors.category ? "category-error" : undefined}>
        <legend className="mb-1 text-sm font-medium">What kind of business is it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors duration-(--duration-fast) hover:bg-accent has-checked:border-stamp has-checked:bg-stamp-subtle has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="category"
                value={code}
                defaultChecked={state.values?.category === code}
                required
                className="sr-only"
              />
              <CategoryIcon code={code} className="text-ink-subtle" />
              <span className="leading-tight">{CATEGORIES[code].label}</span>
            </label>
          ))}
        </div>
        {errors.category ? (
          <FieldError id="category-error">{errors.category[0]}</FieldError>
        ) : (
          <FieldDescription>Adds a matching icon and example wording. It never changes your taxes or documents.</FieldDescription>
        )}
      </fieldset>
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
