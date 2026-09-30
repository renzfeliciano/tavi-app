import { z } from "zod";
import { tooLong } from "@/shared/validation/messages";

// Tax rates are stored as integer basis points (12% = 1200), never floats
// (docs/foundation-proposal.md §B.2).

export const TAX_RATE_LIMITS = {
  name: 40,
  /** Longest accepted rate as typed, e.g. "100.00%". */
  rateInput: "100.00%".length,
} as const;

const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "12" → 1200, "12.5" → 1250, "0.25" → 25. Null for anything else, or over 100%. */
export function parsePercentToBps(input: string): number | null {
  const match = PERCENT.exec(input.trim().replace(/%$/, "").trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const bps = whole * 100 + fraction;
  return bps <= 10_000 ? bps : null;
}

/** 1250 → "12.5%". */
export function formatRate(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}%`;
}

export const taxRateInputSchema = z
  .object({
    name: z
      .string({ error: "Give this tax a name." })
      .trim()
      .min(1, { error: "Give this tax a name." })
      .max(TAX_RATE_LIMITS.name, { error: tooLong(TAX_RATE_LIMITS.name) }),
    rate: z.string({ error: "Enter a percentage from 0 to 100, with up to 2 decimals." }).refine(
      (v) => parsePercentToBps(v) !== null,
      { error: "Enter a percentage from 0 to 100, with up to 2 decimals." },
    ),
  })
  .transform(({ name, rate }) => ({ name, rateBps: parsePercentToBps(rate) as number }));

export type TaxRateInput = z.infer<typeof taxRateInputSchema>;
