// Client-side checks for forms that don't go through a server action (sign-in, sign-up, ...).
// The browser's own "Please fill out this field." bubble is switched off with `noValidate`;
// these messages show inline next to each field instead. The server stays the truth.

export type FieldRule = {
  name: string;
  /** Shown when the field is empty (spaces count as empty). */
  required?: string;
  /** Shown when the field has text that isn't an email address. */
  email?: string;
  /** Shown when the field has text but fewer characters than `min`. */
  tooShort?: { min: number; message: string };
  /** Shown when the field's text differs from another field's (a "type it again" box). */
  matches?: { field: string; message: string };
};

export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One error per field with a broken rule, by field name. Fields without a rule are ignored. */
export function validateFields(values: Record<string, string>, rules: FieldRule[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const rule of rules) {
    const value = (values[rule.name] ?? "").trim();
    if (!value && rule.required) errors[rule.name] = rule.required;
    else if (value && rule.email && !EMAIL.test(value)) errors[rule.name] = rule.email;
    else if (value && rule.tooShort && value.length < rule.tooShort.min) errors[rule.name] = rule.tooShort.message;
    else if (value && rule.matches && (values[rule.matches.field] ?? "").trim() !== value) errors[rule.name] = rule.matches.message;
  }
  return errors;
}

/** The first field with an error, in the order the rules are listed (the order on screen). */
export function firstInvalid(errors: FieldErrors, rules: FieldRule[]): string | undefined {
  return rules.find((rule) => errors[rule.name])?.name;
}
