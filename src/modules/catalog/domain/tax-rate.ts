import { z } from "zod";
import { parseDecimalInput } from "@/shared/numbers/decimal-input";
import { tooLong } from "@/shared/validation/messages";

// Tax rates are stored as integer basis points (12% = 1200), never floats
// (docs/foundation-proposal.md §B.2). Typed and shown in the business's locale.

export const TAX_RATE_LIMITS = {
  name: 40,
  /** Longest accepted rate as typed, e.g. "100.00 %". */
  rateInput: "100.00 %".length,
} as const;

const MAX_BPS = 10_000;
const RATE_ERROR = "Enter a percentage from 0 to 100, with up to 2 decimals.";

/** "12" → 1200, "12.5" → 1250 ("19,5" in de-DE). Null for anything else, or over 100%. */
export function parsePercentToBps(input: string, locale: string): number | null {
  const bps = parseDecimalInput(input.trim().replace(/%$/, ""), { locale, scale: 2, maxWholeDigits: 3 });
  return bps !== null && bps <= MAX_BPS ? bps : null;
}

/** Basis points as the exact decimal fraction Intl formats ("0.125" for 1250), never a float division. */
const asFraction = (bps: number) =>
  `${Math.trunc(bps / MAX_BPS)}.${String(bps % MAX_BPS).padStart(4, "0")}` as unknown as number;

/** 1250 → "12.5%" (en), "12,5 %" (de). */
export function formatRate(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(asFraction(bps));
}

/** 1250 → "12.5": the number alone, for an input next to a "%" label. */
export function formatRateForInput(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    `${Math.trunc(bps / 100)}.${String(bps % 100).padStart(2, "0")}` as unknown as number,
  );
}

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
