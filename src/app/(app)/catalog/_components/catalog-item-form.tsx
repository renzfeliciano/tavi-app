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
import { CATALOG_ITEM_LIMITS as LIMITS, type CatalogItemKind } from "@/modules/catalog/client";
import { type CatalogFormState, type CatalogFormValues, saveCatalogItem } from "../actions";
import { itemHref, KIND_LABEL } from "../_lib/kinds";

/** Wording and choices from the business's market and settings. */
export type CatalogItemFormCopy = {
  /** The market's usual unit for this kind, e.g. "hour". */
  defaultUnit: string;
  /** An example price in the business's format, e.g. "1,250.50". */
  pricePlaceholder: string;
  /** Whether prices are entered with tax included (from Settings). */
  taxModeHint: string;
  currencies: CurrencyOption[];
  taxRates: { id: string; label: string }[];
};

type CatalogItemFormProps = {
  kind: CatalogItemKind;
  /** Present when editing. */
  itemId?: string;
  initialValues: CatalogFormValues;
  copy: CatalogItemFormCopy;
};

export function CatalogItemForm({ kind, itemId, initialValues, copy }: CatalogItemFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CatalogFormState, FormData>(saveCatalogItem, {});
  const v = state.values ?? initialValues;
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const label = KIND_LABEL[kind];
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    const saved = state.saved;
    if (!saved || handled.current === saved.at) return;
    handled.current = saved.at;
    if (itemId) {
      toast.success(`${label.title} saved.`);
    } else {
      toast.success(`${saved.name} added.`);
      router.push(itemHref(kind, saved.id));
    }
  }, [state.saved, itemId, kind, label.title, router]);

  return (
    <form action={formAction} noValidate className="grid gap-8">
      <FormAlert message={state.error} />
      {state.fieldErrors && (
        <p role="alert" className="sr-only">
          Some details need fixing. Check the highlighted fields.
        </p>
      )}
      <input type="hidden" name="kind" value={kind} />
      {itemId && <input type="hidden" name="id" value={itemId} />}
      <div key={state.submission} className="grid gap-8">
        <FormSection title={label.title} description="How it appears on your documents.">
          <FormField name="name" label="Name" error={error("name")} className="sm:col-span-2">
            {(p) => <Input {...p} defaultValue={v.name} maxLength={LIMITS.name} autoFocus={!itemId} />}
          </FormField>
          <FormField
            name="description"
            label="Description"
            optional
            hint="Shown under the name on each line."
            error={error("description")}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} defaultValue={v.description} maxLength={LIMITS.description} rows={2} />}
          </FormField>
          {kind === "product" && (
            <FormField name="sku" label="SKU" optional hint="Your own code for it, if you use one." error={error("sku")}>
              {(p) => (
                <Input {...p} defaultValue={v.sku} maxLength={LIMITS.sku} spellCheck={false} className="font-mono" />
              )}
            </FormField>
          )}
        </FormSection>

        <FormSection title="Price" description={copy.taxModeHint}>
          <FormField name="unitPrice" label="Price per unit" error={error("unitPrice")}>
            {(p) => (
              <Input
                {...p}
                defaultValue={v.unitPrice}
                inputMode="decimal"
                placeholder={copy.pricePlaceholder}
                className="font-mono tabular-nums"
              />
            )}
          </FormField>
          <FormField name="currency" label="Currency" error={error("currency")}>
            {(p) => (
              <NativeSelect {...p} defaultValue={v.currency}>
                {copy.currencies.map(({ code, label: currencyLabel }) => (
                  <option key={code} value={code}>
                    {currencyLabel}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            name="unitLabel"
            label="Unit"
            hint={`What one of these is counted in, e.g. ${copy.defaultUnit}.`}
            error={error("unitLabel")}
          >
            {(p) => <Input {...p} defaultValue={v.unitLabel} maxLength={LIMITS.unitLabel} />}
          </FormField>
          <FormField
            name="taxRateId"
            label="Tax"
            hint="Added to new lines; you can change it on any line."
            error={error("taxRateId")}
          >
            {(p) => (
              <NativeSelect {...p} defaultValue={v.taxRateId}>
                <option value="">No tax</option>
                {copy.taxRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </FormSection>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" pending={pending} pendingLabel="Saving…" className="w-full sm:w-auto">
          {itemId ? "Save changes" : `Add ${label.singular}`}
        </Button>
      </div>
    </form>
  );
}
