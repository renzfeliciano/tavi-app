import { z } from "zod";
import { isCurrencyCode } from "@/shared/money";

// The business details that appear on quotes and invoices, plus document
// defaults (docs/foundation-proposal.md §B.1, §G.5). Blank optional fields are
// stored as null.

const text = (value: unknown) => (typeof value === "string" ? value : "");

const optionalText = (max: number, tooLong: string) =>
  z.preprocess(
    text,
    z
      .string()
      .trim()
      .max(max, { error: tooLong })
      .transform((v) => (v === "" ? null : v)),
  );

const days = (min: number, max: number) =>
  z.preprocess(
    (v) => (text(v).trim() === "" ? Number.NaN : Number(text(v))),
    z
      .number({ error: `Choose between ${min} and ${max} days.` })
      .int({ error: `Choose between ${min} and ${max} days.` })
      .min(min, { error: `Choose between ${min} and ${max} days.` })
      .max(max, { error: `Choose between ${min} and ${max} days.` }),
  );

const TIN = /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/;

export const businessProfileSchema = z.object({
  name: z.preprocess(
    text,
    z
      .string()
      .trim()
      .min(1, { error: "Enter your business name." })
      .max(120, { error: "Use 120 characters or fewer." }),
  ),
  legalName: optionalText(160, "Use 160 characters or fewer."),
  taxId: z.preprocess(
    text,
    z
      .string()
      .trim()
      .refine((v) => v === "" || TIN.test(v), { error: "Enter your TIN as digits, e.g. 123-456-789-00000." })
      .transform((v) => (v === "" ? null : v)),
  ),
  email: z.preprocess(
    text,
    z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || z.email().safeParse(v).success, { error: "Enter a valid email address." })
      .transform((v) => (v === "" ? null : v)),
  ),
  phone: optionalText(40, "Use 40 characters or fewer."),
  addressLine1: optionalText(160, "Use 160 characters or fewer."),
  addressLine2: optionalText(160, "Use 160 characters or fewer."),
  city: optionalText(80, "Use 80 characters or fewer."),
  province: optionalText(80, "Use 80 characters or fewer."),
  postalCode: optionalText(12, "Use 12 characters or fewer."),
  currency: z.preprocess(text, z.string().refine(isCurrencyCode, { error: "Choose a currency." })),
  taxMode: z.preprocess(
    text,
    z.enum(["inclusive", "exclusive"], { error: "Choose how your prices handle tax." }),
  ),
  quoteValidityDays: days(1, 365),
  paymentTermsDays: days(0, 365),
  defaultNotes: optionalText(2000, "Use 2,000 characters or fewer."),
  defaultTerms: optionalText(2000, "Use 2,000 characters or fewer."),
  paymentInstructions: optionalText(2000, "Use 2,000 characters or fewer."),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
