"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CurrencyOption } from "@/config/currencies";
import { CUSTOMER_LIMITS as LIMITS } from "@/modules/customers/client";
import { type CustomerFormState, type CustomerFormValues, saveCustomer } from "../actions";

/** Country-specific wording, from the business's market profile. */
export type CustomerFormCopy = {
  taxIdLabel: string;
  /** e.g. "quotations and billing statements". */
  documents: string;
  address: { line2Label: string; cityLabel: string; regionLabel: string; postalCodeLabel: string };
  /** The business's own currency, offered as the default ("Same as your business"). */
  businessCurrency: string;
  currencies: CurrencyOption[];
};

export const EMPTY_CUSTOMER: CustomerFormValues = {
  displayName: "",
  company: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  taxId: "",
  currency: "",
  notes: "",
};

type CustomerFormProps = {
  /** Present when editing. */
  customerId?: string;
  initialValues: CustomerFormValues;
  copy: CustomerFormCopy;
  /**
   * What happens after a save. By default a new customer opens its page and
   * an edit stays put; the quote editor passes its own (inline create, 1.5).
   */
  onSaved?: (customer: { id: string; displayName: string }) => void;
};

export function CustomerForm({ customerId, initialValues, copy, onSaved }: CustomerFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(saveCustomer, {});
  const v = state.values ?? initialValues;
  const error = (field: keyof CustomerFormValues) => state.fieldErrors?.[field]?.[0];
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    const saved = state.saved;
    if (!saved || handled.current === saved.at) return;
    handled.current = saved.at;
    if (onSaved) return onSaved(saved);
    if (customerId) {
      toast.success("Customer saved.");
    } else {
      toast.success(`${saved.displayName} added.`);
      router.push(`/customers/${saved.id}`);
    }
  }, [state.saved, customerId, onSaved, router]);

  return (
    <form action={formAction} noValidate className="grid gap-8">
      <FormAlert message={state.error} />
      {state.fieldErrors && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      {customerId && <input type="hidden" name="id" value={customerId} />}
      <div key={state.submission} className="grid gap-8">
        <FormSection title="Customer" description="Who you're quoting and billing.">
          <FormField
            name="displayName"
            label="Name"
            hint="A person or a business, as it should appear on documents."
            error={error("displayName")}
          >
            {(p) => (
              <Input
                {...p}
                defaultValue={v.displayName}
                maxLength={LIMITS.displayName}
                autoComplete="off"
                autoFocus={!customerId}
              />
            )}
          </FormField>
          <FormField name="company" label="Company" optional error={error("company")}>
            {(p) => <Input {...p} defaultValue={v.company} maxLength={LIMITS.company} autoComplete="off" />}
          </FormField>
          <FormField name="email" label="Email" optional hint={`Where ${copy.documents} are sent.`} error={error("email")}>
            {(p) => <Input {...p} type="email" defaultValue={v.email} maxLength={LIMITS.email} autoComplete="off" />}
          </FormField>
          <FormField name="phone" label="Phone" optional error={error("phone")}>
            {(p) => <Input {...p} type="tel" defaultValue={v.phone} maxLength={LIMITS.phone} autoComplete="off" />}
          </FormField>
        </FormSection>

        <FormSection title="Billing details" description="Printed on documents you send them.">
          <FormField name="addressLine1" label="Street address" optional error={error("addressLine1")}>
            {(p) => <Input {...p} defaultValue={v.addressLine1} maxLength={LIMITS.addressLine} autoComplete="off" />}
          </FormField>
          <FormField name="addressLine2" label={copy.address.line2Label} optional error={error("addressLine2")}>
            {(p) => <Input {...p} defaultValue={v.addressLine2} maxLength={LIMITS.addressLine} autoComplete="off" />}
          </FormField>
          <FormField name="city" label={copy.address.cityLabel} optional error={error("city")}>
            {(p) => <Input {...p} defaultValue={v.city} maxLength={LIMITS.city} autoComplete="off" />}
          </FormField>
          <FormField name="region" label={copy.address.regionLabel} optional error={error("region")}>
            {(p) => <Input {...p} defaultValue={v.region} maxLength={LIMITS.region} autoComplete="off" />}
          </FormField>
          <FormField name="postalCode" label={copy.address.postalCodeLabel} optional error={error("postalCode")}>
            {(p) => (
              <Input
                {...p}
                defaultValue={v.postalCode}
                maxLength={LIMITS.postalCode}
                inputMode="numeric"
                autoComplete="off"
                className="sm:max-w-40"
              />
            )}
          </FormField>
          <FormField
            name="taxId"
            label={copy.taxIdLabel}
            optional
            hint="For business customers who need it on their documents."
            error={error("taxId")}
          >
            {(p) => <Input {...p} defaultValue={v.taxId} maxLength={LIMITS.taxId} className="font-mono" />}
          </FormField>
          <FormField
            name="currency"
            label="Bill in"
            hint={`New ${copy.documents} for them start in this currency.`}
            error={error("currency")}
          >
            {(p) => (
              <NativeSelect {...p} defaultValue={v.currency}>
                <option value="">Same as your business ({copy.businessCurrency})</option>
                {copy.currencies
                  .filter((c) => c.code !== copy.businessCurrency)
                  .map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </FormField>
        </FormSection>

        <FormSection title="Notes" description="Only you and your team see these.">
          <FormField
            name="notes"
            label="Private notes"
            optional
            hint="Gate codes, preferred contact times, anything useful."
            error={error("notes")}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} defaultValue={v.notes} maxLength={LIMITS.notes} rows={3} />}
          </FormField>
        </FormSection>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          pending={pending}
          pendingLabel="Saving…"
          className="w-full sm:w-auto"
        >
          {customerId ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
