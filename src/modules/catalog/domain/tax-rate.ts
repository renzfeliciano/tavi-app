import { z } from "zod";
import { parsePercentToBps } from "@/shared/numbers/percent";
import { tooLong } from "@/shared/validation/messages";

// Tax rates are stored as integer basis points (12% = 1200), never floats
// (docs/foundation-proposal.md §B.2). Typed and shown in the business's locale.

export const TAX_RATE_LIMITS = {
  name: 40,
  /** Longest accepted rate as typed, e.g. "100.00 %". */
  rateInput: "100.00 %".length,
} as const;

const RATE_ERROR = "Enter a percentage from 0 to 100, with up to 2 decimals.";

export function taxRateInputSchemaFor(locale: string) {
  return z
    .object({
      name: z
        .string({ error: "Give this tax a name." })
        .trim()
        .min(1, { error: "Give this tax a name." })
        .max(TAX_RATE_LIMITS.name, { error: tooLong(TAX_RATE_LIMITS.name) }),
      rate: z
        .string({ error: RATE_ERROR })
        .refine((v) => parsePercentToBps(v, locale) !== null, { error: RATE_ERROR }),
    })
    .transform(({ name, rate }) => ({ name, rateBps: parsePercentToBps(rate, locale) as number }));
}

export type TaxRateInput = z.infer<ReturnType<typeof taxRateInputSchemaFor>>;

// Re-exported for the catalog module's callers.
export { formatRate, formatRateForInput, parsePercentToBps } from "@/shared/numbers/percent";
