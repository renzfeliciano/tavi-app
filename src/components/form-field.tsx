import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

export type FormControlProps = {
  id: string;
  name: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FormFieldProps = {
  name: string;
  /** Defaults to `field-<name>`; set it when a page has several forms with the same field. */
  id?: string;
  label: ReactNode;
  /** Shown under the control until there's an error. */
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Sits at the right end of the label row (e.g. "Forgot password?"). */
  aside?: ReactNode;
  className?: string;
  /** Renders the control with the id and ARIA wiring for the label, hint and error. */
  children: (control: FormControlProps) => ReactNode;
};

/** One labelled form control with its hint or error (§G.3: errors replace hints, values stay). */
export function FormField({ name, id: idProp, label, hint, error, optional, aside, className, children }: FormFieldProps) {
  const id = idProp ?? `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <Field data-invalid={error ? "true" : undefined} className={className}>
      {aside ? (
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {aside}
        </div>
      ) : (
        <FieldLabel htmlFor={id}>
          {label}
          {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
        </FieldLabel>
      )}
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      )}
    </Field>
  );
}
