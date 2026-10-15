import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/shared/validation/fields";
import { SUPPLIER_LIMITS as LIMITS } from "./limits";

// A supplier: who a purchase order is for (docs/superpowers/specs/2026-10-15-purchase-orders-design.md, P2).
// Only the name is required. The tax ID has no format check: suppliers can be
// abroad or unregistered.
export const supplierInputSchema = z.object({
  displayName: requiredText(LIMITS.displayName, "Enter the supplier's name."),
  contactName: optionalText(LIMITS.contactName),
  email: optionalEmail(LIMITS.email),
  phone: optionalText(LIMITS.phone),
  addressLine1: optionalText(LIMITS.addressLine),
  addressLine2: optionalText(LIMITS.addressLine),
  city: optionalText(LIMITS.city),
  region: optionalText(LIMITS.region),
  postalCode: optionalText(LIMITS.postalCode),
  taxId: optionalText(LIMITS.taxId),
  notes: optionalText(LIMITS.notes),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;

/** The fields a supplier form posts. */
export const SUPPLIER_FIELDS = [
  "displayName",
  "contactName",
  "email",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "taxId",
  "notes",
] as const satisfies readonly (keyof SupplierInput)[];
