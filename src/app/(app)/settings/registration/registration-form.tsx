"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { REGISTRATION_LIMITS, type RegistrationField } from "@/modules/organizations/client";
import { eg } from "@/shared/text/example";
import { type RegistrationFormState, type RegistrationValues, saveRegistrationAction } from "./actions";

/** The market's registration wording, without anything a browser can't receive (no patterns). */
export type RegistrationCopy = {
  authority: string;
  taxpayerTypes: { code: string; label: string; individual: boolean }[];
  incomeTaxOptions: { code: string; label: string; hint: string }[];
  office: { label: string; hint: string; example: string };
  taxRegisteredOnLabel: string;
  lineOfBusinessHint: string;
  lineOfBusinessExample: string;
  industryCode: { label: string; hint: string; example: string };
  authorities: { code: string; label: string; numberLabel: string; scoped: boolean; expires: boolean }[];
  scopes: { code: string; label: string }[];
};

export function RegistrationForm({
  initial,
  copy,
  editable,
}: {
  initial: RegistrationValues;
  copy: RegistrationCopy;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<RegistrationFormState, FormData>(saveRegistrationAction, {});
  const values = state.values ?? initial;
  const error = (field: RegistrationField) => state.errors?.[field];

  // The fields that depend on a choice appear with it; their values live here so the choice can change them.
  const [taxpayerType, setTaxpayerType] = useState(values.taxpayerType);
  const [authority, setAuthority] = useState(values.nameRegistrationAuthority);
  const individual = copy.taxpayerTypes.find((t) => t.code === taxpayerType)?.individual ?? false;
  const authorityConfig = copy.authorities.find((a) => a.code === authority);

  useEffect(() => {
    if (state.savedAt) toast.success("Registration details saved.");
  }, [state.savedAt]);

  return (
    <form action={formAction} noValidate key={state.savedAt ?? "initial"} className="grid gap-8">
      <FormAlert message={state.errors?.form} />
      <fieldset disabled={!editable} className="grid min-w-0 gap-8">
        <legend className="sr-only">Registration details</legend>

        <FormSection title={`${copy.authority} registration`} description="As on your Certificate of Registration.">
          <FormField name="taxpayerType" label="Taxpayer type" optional error={error("taxpayerType")}>
            {(p) => (
              <NativeSelect {...p} value={taxpayerType} onChange={(e) => setTaxpayerType(e.target.value)}>
                <option value="">Not set yet</option>
                {copy.taxpayerTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {individual ? (
            <FormField
              name="incomeTaxOption"
              label="Income tax"
              optional
              hint={copy.incomeTaxOptions.find((o) => o.code === values.incomeTaxOption)?.hint}
              error={error("incomeTaxOption")}
            >
              {(p) => (
                <NativeSelect {...p} defaultValue={values.incomeTaxOption}>
                  <option value="">Not set yet</option>
                  {copy.incomeTaxOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ) : (
            <div aria-hidden="true" className="hidden sm:block" />
          )}
          <FormField name="taxOfficeCode" label={copy.office.label} optional hint={copy.office.hint} error={error("taxOfficeCode")}>
            {(p) => (
              <Input {...p} defaultValue={values.taxOfficeCode} inputMode="numeric" maxLength={8} placeholder={copy.office.example} className="font-mono" />
            )}
          </FormField>
          <FormField name="taxRegisteredOn" label={copy.taxRegisteredOnLabel} optional error={error("taxRegisteredOn")}>
            {(p) => <Input {...p} type="date" defaultValue={values.taxRegisteredOn} />}
          </FormField>
          <FormField
            name="lineOfBusiness"
            label="Line of business"
            optional
            hint={copy.lineOfBusinessHint}
            error={error("lineOfBusiness")}
          >
            {(p) => (
              <Input
                {...p}
                defaultValue={values.lineOfBusiness}
                maxLength={REGISTRATION_LIMITS.lineOfBusiness}
                placeholder={eg(copy.lineOfBusinessExample)}
              />
            )}
          </FormField>
          <FormField
            name="industryCode"
            label={copy.industryCode.label}
            optional
            hint={copy.industryCode.hint}
            error={error("industryCode")}
          >
            {(p) => (
              <Input {...p} defaultValue={values.industryCode} inputMode="numeric" maxLength={8} placeholder={copy.industryCode.example} className="font-mono" />
            )}
          </FormField>
        </FormSection>

        <FormSection title="Business name registration" description="DTI for a sole proprietor, SEC for a corporation or partnership, CDA for a cooperative.">
          <FormField name="nameRegistrationAuthority" label="Registered with" optional error={error("nameRegistrationAuthority")}>
            {(p) => (
              <NativeSelect {...p} value={authority} onChange={(e) => setAuthority(e.target.value)}>
                <option value="">Not set yet</option>
                {copy.authorities.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {authorityConfig ? (
            <FormField
              name="nameRegistrationNumber"
              label={authorityConfig.numberLabel}
              error={error("nameRegistrationNumber")}
            >
              {(p) => (
                <Input
                  {...p}
                  defaultValue={values.nameRegistrationNumber}
                  maxLength={REGISTRATION_LIMITS.registrationNumber}
                  placeholder={eg("1234567")}
                  spellCheck={false}
                  className="font-mono"
                />
              )}
            </FormField>
          ) : (
            <div aria-hidden="true" className="hidden sm:block" />
          )}
          {authorityConfig?.scoped && (
            <FormField name="nameRegistrationScope" label="Scope" optional hint="Where the name is protected." error={error("nameRegistrationScope")}>
              {(p) => (
                <NativeSelect {...p} defaultValue={values.nameRegistrationScope}>
                  <option value="">Not set yet</option>
                  {copy.scopes.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
          {authorityConfig?.expires && (
            <>
              <FormField name="nameRegistrationValidFrom" label="Valid from" optional error={error("nameRegistrationValidFrom")}>
                {(p) => <Input {...p} type="date" defaultValue={values.nameRegistrationValidFrom} />}
              </FormField>
              <FormField
                name="nameRegistrationValidUntil"
                label="Valid until"
                optional
                hint="We remind you before it lapses."
                error={error("nameRegistrationValidUntil")}
              >
                {(p) => <Input {...p} type="date" defaultValue={values.nameRegistrationValidUntil} />}
              </FormField>
            </>
          )}
        </FormSection>
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
