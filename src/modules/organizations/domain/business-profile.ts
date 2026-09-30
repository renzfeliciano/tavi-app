import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import {
  optionalEmail,
  optionalText,
  requiredCurrency,
  requiredText,
} from "@/shared/validation/fields";
import { dayRange, tooLong } from "@/shared/validation/messages";
import { BUSINESS_PROFILE_LIMITS as LIMITS } from "./limits";

// The business details that appear on quotes and invoices, plus document
// defaults (docs/foundation-proposal.md §B.1, §G.5). Blank optional fields are
// stored as null. Market-specific rules (the tax-ID format) come from the
// business's market profile.

const text = (value: unknown) => (typeof value === "string" ? value : "");

const days = (range: { min: number; max: number }) =>
  z.preprocess(
    (v) => (text(v).trim() === "" ? Number.NaN : Number(text(v))),
    z
      .number({ error: dayRange(range) })
      .int({ error: dayRange(range) })
      .min(range.min, { error: dayRange(range) })
      .max(range.max, { error: dayRange(range) }),
  );

export function businessProfileSchemaFor(market: Pick<MarketProfile, "taxId">) {
  const { label, pattern, example } = market.taxId;
  return z.object({
    name: requiredText(LIMITS.name, "Enter your business name."),
    legalName: optionalText(LIMITS.legalName),
    taxId: z.preprocess(
      text,
      z
        .string()
        .trim()
        .max(LIMITS.taxId, { error: tooLong(LIMITS.taxId) })
        .refine((v) => v === "" || pattern.test(v), { error: `Enter your ${label} like ${example}.` })
        .transform((v) => (v === "" ? null : v)),
    ),
    email: optionalEmail(LIMITS.email),
    phone: optionalText(LIMITS.phone),
    addressLine1: optionalText(LIMITS.addressLine),
    addressLine2: optionalText(LIMITS.addressLine),
    city: optionalText(LIMITS.city),
    region: optionalText(LIMITS.region),
    postalCode: optionalText(LIMITS.postalCode),
    currency: requiredCurrency(),
    taxMode: z.preprocess(
      text,
      z.enum(["inclusive", "exclusive"], { error: "Choose how your prices handle tax." }),
    ),
    quoteValidityDays: days(LIMITS.quoteValidityDays),
    paymentTermsDays: days(LIMITS.paymentTermsDays),
    defaultNotes: optionalText(LIMITS.longText),
    defaultTerms: optionalText(LIMITS.longText),
    paymentInstructions: optionalText(LIMITS.longText),
  });
}

export type BusinessProfileInput = z.infer<ReturnType<typeof businessProfileSchemaFor>>;

/** The fields a business profile form posts. */
export const BUSINESS_PROFILE_FIELDS = [
  "name",
  "legalName",
  "taxId",
  "email",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "currency",
  "taxMode",
  "quoteValidityDays",
  "paymentTermsDays",
  "defaultNotes",
  "defaultTerms",
  "paymentInstructions",
] as const satisfies readonly (keyof BusinessProfileInput)[];
