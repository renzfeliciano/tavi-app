"use client";

import { type ComponentProps, type ReactNode, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "@/config/currencies";
import { type BusinessProfileState, type ProfileFormValues, saveBusinessProfile } from "./actions";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </header>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">{children}</div>
    </section>
  );
}

const TAX_MODES = [
  {
    value: "inclusive",
    label: "Prices include tax",
    description: "₱1,120 means ₱1,000 + ₱120 VAT. Common in the Philippines.",
  },
  {
    value: "exclusive",
    label: "Tax is added on top",
    description: "₱1,000 becomes ₱1,120 with 12% VAT.",
  },
] as const;

export function BusinessProfileForm({
  initialValues,
  editable,
}: {
  initialValues: ProfileFormValues;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<BusinessProfileState, FormData>(
    saveBusinessProfile,
    { values: initialValues },
  );
  const v = state.values;
  const error = (field: keyof ProfileFormValues) => state.fieldErrors?.[field]?.[0];

  useEffect(() => {
    if (state.savedAt) toast.success("Business profile saved.");
  }, [state.savedAt]);

  return (
    <form action={formAction} noValidate className="grid gap-8">
      <FormAlert message={state.error} />
      {state.fieldErrors && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      <fieldset key={state.submission} disabled={!editable} className="grid min-w-0 gap-8">
        <legend className="sr-only">Business profile</legend>
        <Section title="Business details" description="How your business is named on documents.">
          <FormField
            name="name"
            label="Business name"
            hint="As customers know you."
            error={error("name")}
          >
            {(p) => <Input {...p} defaultValue={v.name} maxLength={120} autoComplete="organization" />}
          </FormField>
          <FormField
            name="legalName"
            label="Registered name"
            optional
            hint="If different, e.g. as on your DTI or SEC papers."
            error={error("legalName")}
          >
            {(p) => <Input {...p} defaultValue={v.legalName} maxLength={160} />}
          </FormField>
          <FormField
            name="taxId"
            label="TIN"
            optional
            hint="Printed on your documents, e.g. 123-456-789-00000."
            error={error("taxId")}
          >
            {(p) => (
              <Input {...p} defaultValue={v.taxId} inputMode="numeric" maxLength={20} className="font-mono" />
            )}
          </FormField>
        </Section>

        <Section title="Contact and address" description="Shown on documents so customers can reach you.">
          <FormField name="email" label="Email" optional error={error("email")}>
            {(p) => <Input {...p} type="email" defaultValue={v.email} autoComplete="email" maxLength={254} />}
          </FormField>
          <FormField name="phone" label="Phone" optional error={error("phone")}>
            {(p) => <Input {...p} type="tel" defaultValue={v.phone} autoComplete="tel" maxLength={40} />}
          </FormField>
          <FormField name="addressLine1" label="Street address" optional error={error("addressLine1")}>
            {(p) => (
              <Input {...p} defaultValue={v.addressLine1} autoComplete="address-line1" maxLength={160} />
            )}
          </FormField>
          <FormField
            name="addressLine2"
            label="Building, unit or barangay"
            optional
            error={error("addressLine2")}
          >
            {(p) => (
              <Input {...p} defaultValue={v.addressLine2} autoComplete="address-line2" maxLength={160} />
            )}
          </FormField>
          <FormField name="city" label="City or municipality" optional error={error("city")}>
            {(p) => <Input {...p} defaultValue={v.city} autoComplete="address-level2" maxLength={80} />}
          </FormField>
          <FormField name="province" label="Province" optional error={error("province")}>
            {(p) => <Input {...p} defaultValue={v.province} autoComplete="address-level1" maxLength={80} />}
          </FormField>
          <FormField name="postalCode" label="ZIP code" optional error={error("postalCode")}>
            {(p) => (
              <Input
                {...p}
                defaultValue={v.postalCode}
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={12}
                className="sm:max-w-40"
              />
            )}
          </FormField>
        </Section>

        <Section
          title="Quotes and billing statements"
          description="Where new documents start. Documents you've already sent don't change."
        >
          <FormField
            name="currency"
            label="Currency"
            hint="You can still bill a customer in another currency."
            error={error("currency")}
          >
            {(p) => (
              <NativeSelect {...p} defaultValue={v.currency}>
                {CURRENCIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {code} · {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <fieldset
            className="grid gap-2 sm:col-span-2"
            aria-describedby={error("taxMode") ? "field-taxMode-error" : undefined}
          >
            <legend className="mb-2 text-sm font-medium">Your prices</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TAX_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 transition-colors duration-(--duration-fast) hover:border-border-strong has-checked:border-stamp has-checked:bg-stamp-subtle has-focus-visible:ring-3 has-focus-visible:ring-ring/35 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <input
                    type="radio"
                    name="taxMode"
                    value={mode.value}
                    defaultChecked={v.taxMode === mode.value}
                    className="mt-0.5 size-4 accent-stamp"
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{mode.label}</span>
                    <span className="text-sm text-pretty text-muted-foreground">{mode.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {error("taxMode") && (
              <p id="field-taxMode-error" className="text-sm text-destructive">
                {error("taxMode")}
              </p>
            )}
          </fieldset>
          <FormField
            name="quoteValidityDays"
            label="Quotes are valid for"
            hint="Days a customer has to approve."
            error={error("quoteValidityDays")}
          >
            {(p) => <DaysInput {...p} defaultValue={v.quoteValidityDays} />}
          </FormField>
          <FormField
            name="paymentTermsDays"
            label="Payment is due in"
            hint="Days after you send. 0 means due on receipt."
            error={error("paymentTermsDays")}
          >
            {(p) => <DaysInput {...p} defaultValue={v.paymentTermsDays} />}
          </FormField>
        </Section>

        <Section
          title="Notes, terms and payment"
          description="Added to every new quote and billing statement. You can change them on each one."
        >
          <FormField
            name="paymentInstructions"
            label="How to pay you"
            optional
            hint="Bank account, GCash or Maya number. Shown on billing statements."
            error={error("paymentInstructions")}
            className="sm:col-span-2"
          >
            {(p) => (
              <Textarea
                {...p}
                defaultValue={v.paymentInstructions}
                maxLength={2000}
                rows={3}
                placeholder={"BDO Savings 0012 3456 7890 (Maria Santos)\nGCash 0917 555 0100"}
              />
            )}
          </FormField>
          <FormField
            name="defaultNotes"
            label="Notes"
            optional
            hint="A thank-you, or what's included."
            error={error("defaultNotes")}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} defaultValue={v.defaultNotes} maxLength={2000} rows={2} />}
          </FormField>
          <FormField
            name="defaultTerms"
            label="Terms and conditions"
            optional
            hint="Warranty, cancellation and similar."
            error={error("defaultTerms")}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} defaultValue={v.defaultTerms} maxLength={2000} rows={3} />}
          </FormField>
        </Section>
      </fieldset>

      {editable && (
        <div className="flex justify-end">
          <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…" className="w-full sm:w-auto">
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

function DaysInput(props: ComponentProps<typeof Input>) {
  return (
    <div className="flex items-center gap-2">
      <Input {...props} inputMode="numeric" maxLength={3} className="w-24 font-mono tabular-nums" />
      <span className="text-sm text-muted-foreground">days</span>
    </div>
  );
}
