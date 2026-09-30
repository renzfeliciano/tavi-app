import { z } from "zod";
import {
  optionalCurrency,
  optionalEmail,
  optionalText,
  requiredText,
} from "@/shared/validation/fields";
import { CUSTOMER_LIMITS as LIMITS } from "./limits";

// A customer: who a quote or invoice is for (docs/foundation-proposal.md §B.1).
// Only the name is required, so a walk-in customer takes one field. The tax ID
// has no format check: customers can be abroad or unregistered. A blank
// currency means "use the business's currency".
export const customerInputSchema = z.object({
  displayName: requiredText(LIMITS.displayName, "Enter the customer's name."),
  company: optionalText(LIMITS.company),
  email: optionalEmail(LIMITS.email),
  phone: optionalText(LIMITS.phone),
  addressLine1: optionalText(LIMITS.addressLine),
  addressLine2: optionalText(LIMITS.addressLine),
  city: optionalText(LIMITS.city),
  region: optionalText(LIMITS.region),
  postalCode: optionalText(LIMITS.postalCode),
  taxId: optionalText(LIMITS.taxId),
  currency: optionalCurrency(),
  notes: optionalText(LIMITS.notes),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/** The fields a customer form posts. */
export const CUSTOMER_FIELDS = [
  "displayName",
  "company",
  "email",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "taxId",
  "currency",
  "notes",
] as const satisfies readonly (keyof CustomerInput)[];
