"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MarketExamples } from "@/config/markets";
import { SUPPLIER_LIMITS as LIMITS } from "@/modules/purchasing/client";
import { eg } from "@/shared/text/example";
import { type SupplierFormState, type SupplierFormValues, saveSupplier } from "../actions";

/** Country-specific wording, from the business's market profile. */
export type SupplierFormCopy = {
  taxIdLabel: string;
  /** A tax number as the market writes it, for the empty field. */
  taxIdExample: string;
  /** What the empty fields show. */
  examples: MarketExamples;
  address: { line2Label: string; cityLabel: string; regionLabel: string; postalCodeLabel: string };
};

export const EMPTY_SUPPLIER: SupplierFormValues = {
  displayName: "",
  contactName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  taxId: "",
  notes: "",
};

type SupplierFormProps = {
  /** Present when editing. */
  supplierId?: string;
  initialValues: SupplierFormValues;
  copy: SupplierFormCopy;
  /** What happens after a save. By default a new supplier opens its page and an edit stays put. */
  onSaved?: (supplier: { id: string; displayName: string }) => void;
};

export function SupplierForm({ supplierId, initialValues, copy, onSaved }: SupplierFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SupplierFormState, FormData>(saveSupplier, {});
  const v = state.values ?? initialValues;
  const error = (field: keyof SupplierFormValues) => state.fieldErrors?.[field]?.[0];
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    const saved = state.saved;
    if (!saved || handled.current === saved.at) return;
    handled.current = saved.at;
    if (onSaved) return onSaved(saved);
    if (supplierId) {
      toast.success("Supplier saved.");
    } else {
      toast.success(`${saved.displayName} added.`);
      router.push(`/suppliers/${saved.id}`);
    }
  }, [state.saved, supplierId, onSaved, router]);

  return (
    <form action={formAction} noValidate className="grid gap-8">
      <FormAlert message={state.error} />
      {state.fieldErrors && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      {supplierId && <input type="hidden" name="id" value={supplierId} />}
      <div key={state.submission} className="grid gap-8">
        <FormSection title="Supplier" description="Who you buy from.">
          <FormField
            name="displayName"
            label="Name"
            hint="A business or a person, as it should appear on purchase orders."
            error={error("displayName")}
          >
            {(p) => (
              <Input
                {...p}
                defaultValue={v.displayName}
                maxLength={LIMITS.displayName}
                placeholder={eg(copy.examples.business)}
                autoComplete="off"
                autoFocus={!supplierId}
              />
            )}
          </FormField>
          <FormField name="contactName" label="Contact person" optional error={error("contactName")}>
            {(p) => <Input {...p} defaultValue={v.contactName} maxLength={LIMITS.contactName} placeholder={eg(copy.examples.person)} autoComplete="off" />}
          </FormField>
          <FormField name="email" label="Email" optional hint="Where purchase orders are sent." error={error("email")}>
            {(p) => <Input {...p} type="email" defaultValue={v.email} maxLength={LIMITS.email} placeholder={eg(copy.examples.email)} autoComplete="off" />}
          </FormField>
          <FormField name="phone" label="Phone" optional error={error("phone")}>
            {(p) => <Input {...p} type="tel" defaultValue={v.phone} maxLength={LIMITS.phone} placeholder={eg(copy.examples.phone)} autoComplete="off" />}
          </FormField>
        </FormSection>

        <FormSection title="Address and tax number" description="Printed on purchase orders you send them.">
          <FormField name="addressLine1" label="Street address" optional error={error("addressLine1")}>
            {(p) => <Input {...p} defaultValue={v.addressLine1} maxLength={LIMITS.addressLine} placeholder={eg(copy.examples.address.line1)} autoComplete="off" />}
          </FormField>
          <FormField name="addressLine2" label={copy.address.line2Label} optional error={error("addressLine2")}>
            {(p) => <Input {...p} defaultValue={v.addressLine2} maxLength={LIMITS.addressLine} placeholder={eg(copy.examples.address.line2)} autoComplete="off" />}
          </FormField>
          <FormField name="city" label={copy.address.cityLabel} optional error={error("city")}>
            {(p) => <Input {...p} defaultValue={v.city} maxLength={LIMITS.city} placeholder={eg(copy.examples.address.city)} autoComplete="off" />}
          </FormField>
          <FormField name="region" label={copy.address.regionLabel} optional error={error("region")}>
            {(p) => <Input {...p} defaultValue={v.region} maxLength={LIMITS.region} placeholder={eg(copy.examples.address.region)} autoComplete="off" />}
          </FormField>
          <FormField name="postalCode" label={copy.address.postalCodeLabel} optional error={error("postalCode")}>
            {(p) => (
              <Input
                {...p}
                defaultValue={v.postalCode}
                maxLength={LIMITS.postalCode}
                placeholder={eg(copy.examples.address.postalCode)}
                inputMode="numeric"
                autoComplete="off"
                className="sm:max-w-40"
              />
            )}
          </FormField>
          <FormField name="taxId" label={copy.taxIdLabel} optional hint="Printed on the purchase order if you add it." error={error("taxId")}>
            {(p) => <Input {...p} defaultValue={v.taxId} maxLength={LIMITS.taxId} placeholder={eg(copy.taxIdExample)} className="font-mono" />}
          </FormField>
        </FormSection>

        <FormSection title="Notes" description="Only you and your team see these.">
          <FormField
            name="notes"
            label="Private notes"
            optional
            hint="Delivery days, who to ask for, anything useful."
            error={error("notes")}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} defaultValue={v.notes} maxLength={LIMITS.notes} rows={3} placeholder="e.g. Delivers on Tuesdays. Ask for the sales desk." />}
          </FormField>
        </FormSection>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…" className="w-full sm:w-auto">
          {supplierId ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}
