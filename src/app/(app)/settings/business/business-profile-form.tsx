"use client";

import { type ComponentProps, useActionState, useEffect, useId } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { SaveBar, useFormDirty } from "@/components/save-bar";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CurrencyOption } from "@/config/currencies";
import type { MarketExamples } from "@/config/markets";
import { BUSINESS_PROFILE_LIMITS as LIMITS } from "@/modules/organizations/client";
import { eg } from "@/shared/text/example";
import { type BusinessProfileState, type ProfileFormValues, saveBusinessProfile } from "./actions";

/** Country-specific wording, from the business's market profile. */
export type BusinessProfileCopy = {
  taxIdLabel: string;
  taxIdHint: string;
  /** A tax number as the market writes it, for the empty field. */
  taxIdExample: string;
  /** What the empty fields show. */
  examples: MarketExamples;
  /** The market's tax registration statuses (PH: VAT-registered, Non-VAT…). */
  taxRegistrations: { code: string; label: string }[];
  taxRegistrationHint: string;
  businessNameHint: string;
  registeredNameHint: string;
  address: { line2Label: string; cityLabel: string; regionLabel: string; postalCodeLabel: string };
  /** e.g. "Quotations and billing statements". */
  documentsTitle: string;
  /** e.g. "quotation and billing statement". */
  documentsPhrase: string;
  paymentInstructionsHint: string;
  paymentInstructionsPlaceholder: string;
  taxModes: { inclusive: string; exclusive: string };
  currencies: CurrencyOption[];
};

const DAYS_MAX_LENGTH = String(
  Math.max(LIMITS.quoteValidityDays.max, LIMITS.paymentTermsDays.max),
).length;

const TAX_MODES = [
  { value: "inclusive", label: "Prices include tax" },
  { value: "exclusive", label: "Tax is added on top" },
] as const;

export function BusinessProfileForm({
  initialValues,
  copy,
  editable,
}: {
  initialValues: ProfileFormValues;
  copy: BusinessProfileCopy;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<BusinessProfileState, FormData>(
    saveBusinessProfile,
    { values: initialValues },
  );
  const v = state.values;
  const { dirty, formProps } = useFormDirty(state.savedAt);
  const formId = useId();
  const error = (field: keyof ProfileFormValues) => state.fieldErrors?.[field]?.[0];

  useEffect(() => {
    if (state.savedAt) toast.success("Business profile saved.");
  }, [state.savedAt]);

  // The save bar sits beside the form, not in it, so it can stay in view from the top of the page.
  return (
    <>
      <form id={formId} action={formAction} noValidate className="grid gap-8" {...formProps}>
        <FormAlert message={state.error} />
        {state.fieldErrors && (
          <p role="alert" className="sr-only">
            Some details need fixing. Check the highlighted fields.
          </p>
        )}
        <fieldset key={state.submission} disabled={!editable} className="grid min-w-0 gap-8">
          <legend className="sr-only">Business profile</legend>
          <FormSection id="details" title="Business details" description="How your business is named on documents.">
            <FormField
              name="name"
              label="Business name"
              hint={copy.businessNameHint}
              error={error("name")}
            >
              {(p) => <Input {...p} defaultValue={v.name} maxLength={LIMITS.name} placeholder={eg(copy.examples.business)} autoComplete="organization" />}
            </FormField>
            <FormField
              name="legalName"
              label="Registered name"
              optional
              hint={copy.registeredNameHint}
              error={error("legalName")}
            >
              {(p) => <Input {...p} defaultValue={v.legalName} maxLength={LIMITS.legalName} placeholder={eg(copy.examples.person)} />}
            </FormField>
            <FormField
              name="taxId"
              label={copy.taxIdLabel}
              optional
              hint={copy.taxIdHint}
              error={error("taxId")}
            >
              {(p) => (
                <Input {...p} defaultValue={v.taxId} maxLength={LIMITS.taxId} placeholder={eg(copy.taxIdExample)} className="font-mono" />
              )}
            </FormField>
            <FormField
              name="taxRegistration"
              label="Tax registration"
              optional
              hint={copy.taxRegistrationHint}
              error={error("taxRegistration")}
            >
              {(p) => (
                <NativeSelect {...p} defaultValue={v.taxRegistration}>
                  <option value="">Not set yet</option>
                  {copy.taxRegistrations.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </FormSection>

          <FormSection id="contact" title="Contact and address" description="Shown on documents so customers can reach you.">
            <FormField name="email" label="Email" optional error={error("email")}>
              {(p) => <Input {...p} type="email" defaultValue={v.email} autoComplete="email" maxLength={LIMITS.email} placeholder={eg(copy.examples.email)} />}
            </FormField>
            <FormField name="phone" label="Phone" optional error={error("phone")}>
              {(p) => <Input {...p} type="tel" defaultValue={v.phone} autoComplete="tel" maxLength={LIMITS.phone} placeholder={eg(copy.examples.phone)} />}
            </FormField>
            <FormField name="addressLine1" label="Street address" optional error={error("addressLine1")}>
              {(p) => (
                <Input {...p} defaultValue={v.addressLine1} autoComplete="address-line1" maxLength={LIMITS.addressLine} placeholder={eg(copy.examples.address.line1)} />
              )}
            </FormField>
            <FormField
              name="addressLine2"
              label={copy.address.line2Label}
              optional
              error={error("addressLine2")}
            >
              {(p) => (
                <Input {...p} defaultValue={v.addressLine2} autoComplete="address-line2" maxLength={LIMITS.addressLine} placeholder={eg(copy.examples.address.line2)} />
              )}
            </FormField>
            <FormField name="city" label={copy.address.cityLabel} optional error={error("city")}>
              {(p) => <Input {...p} defaultValue={v.city} autoComplete="address-level2" maxLength={LIMITS.city} placeholder={eg(copy.examples.address.city)} />}
            </FormField>
            <FormField name="region" label={copy.address.regionLabel} optional error={error("region")}>
              {(p) => <Input {...p} defaultValue={v.region} autoComplete="address-level1" maxLength={LIMITS.region} placeholder={eg(copy.examples.address.region)} />}
            </FormField>
            <FormField name="postalCode" label={copy.address.postalCodeLabel} optional error={error("postalCode")}>
              {(p) => (
                <Input
                  {...p}
                  defaultValue={v.postalCode}
                  autoComplete="postal-code"
                  placeholder={eg(copy.examples.address.postalCode)}
                  inputMode="numeric"
                  maxLength={LIMITS.postalCode}
                  className="sm:max-w-40"
                />
              )}
            </FormField>
          </FormSection>

          <FormSection
            id="document-defaults"
            title={copy.documentsTitle}
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
                  {copy.currencies.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
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
                      <span className="text-sm text-pretty text-muted-foreground">{copy.taxModes[mode.value]}</span>
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
              {(p) => <DaysInput {...p} defaultValue={v.quoteValidityDays} placeholder={eg("30")} />}
            </FormField>
            <FormField
              name="paymentTermsDays"
              label="Payment is due in"
              hint="Days after you send. 0 means due on receipt."
              error={error("paymentTermsDays")}
            >
              {(p) => <DaysInput {...p} defaultValue={v.paymentTermsDays} placeholder={eg("7")} />}
            </FormField>
          </FormSection>

          <FormSection
            id="terms"
            title="Notes, terms and payment"
            description={`Added to every new ${copy.documentsPhrase}. You can change them on each one.`}
          >
            <FormField
              name="paymentInstructions"
              label="How to pay you"
              optional
              hint={copy.paymentInstructionsHint}
              error={error("paymentInstructions")}
              className="sm:col-span-2"
            >
              {(p) => (
                <Textarea
                  {...p}
                  defaultValue={v.paymentInstructions}
                  maxLength={LIMITS.longText}
                  rows={3}
                  placeholder={copy.paymentInstructionsPlaceholder}
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
              {(p) => <Textarea {...p} defaultValue={v.defaultNotes} maxLength={LIMITS.longText} rows={2} placeholder="e.g. Thank you for your business. Parts and labour are included." />}
            </FormField>
            <FormField
              name="defaultTerms"
              label="Terms and conditions"
              optional
              hint="Warranty, cancellation and similar."
              error={error("defaultTerms")}
              className="sm:col-span-2"
            >
              {(p) => <Textarea {...p} defaultValue={v.defaultTerms} maxLength={LIMITS.longText} rows={3} placeholder="e.g. 50% down payment before work starts. 30-day warranty on labour." />}
            </FormField>
          </FormSection>
        </fieldset>
      </form>
      {editable && <SaveBar form={formId} dirty={dirty} saved={Boolean(state.savedAt)} pending={pending} />}
    </>
  );
}

function DaysInput({ placeholder, ...props }: ComponentProps<typeof Input> & { placeholder: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input {...props} inputMode="numeric" maxLength={DAYS_MAX_LENGTH} placeholder={placeholder} className="w-24 font-mono tabular-nums" />
      <span className="text-sm text-muted-foreground">days</span>
    </div>
  );
}
