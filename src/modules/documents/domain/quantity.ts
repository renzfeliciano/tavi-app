import { parseDecimalInput } from "@/shared/numbers/decimal-input";

// Quantities have up to four decimals (1.5 hours, 0.25 kg) and are handled as
// integers scaled by 10,000 (§B.2), stored as numeric(14,4).

export const QUANTITY_DECIMALS = 4;
export const QUANTITY_SCALE = 10 ** QUANTITY_DECIMALS;
/** Up to 999,999.9999 of anything. */
export const MAX_QUANTITY_WHOLE_DIGITS = 6;

/** "1.5" → 15000. Null for zero, negatives, too many decimals or anything unreadable. */
export function parseQuantityInput(input: string, locale: string): number | null {
  const scaled = parseDecimalInput(input, {
    locale,
    scale: QUANTITY_DECIMALS,
    maxWholeDigits: MAX_QUANTITY_WHOLE_DIGITS,
  });
  return scaled !== null && scaled > 0 ? scaled : null;
}

/** 15000 → "1.5": only the decimals the quantity has, in the locale's format. Exact (formats a decimal string). */
export function formatQuantity(scaled: number, locale: string): string {
  const whole = Math.trunc(scaled / QUANTITY_SCALE);
  const fraction = String(scaled % QUANTITY_SCALE).padStart(QUANTITY_DECIMALS, "0");
  return new Intl.NumberFormat(locale, { maximumFractionDigits: QUANTITY_DECIMALS }).format(
    // Intl accepts exact decimal strings (ES2023); the cast bridges the lib typing.
    `${whole}.${fraction}` as unknown as number,
  );
}

/** Scaled quantity → the exact decimal string Postgres numeric(14,4) stores ("1.5000"). */
export function quantityToNumeric(scaled: number): string {
  const whole = Math.trunc(scaled / QUANTITY_SCALE);
  return `${whole}.${String(scaled % QUANTITY_SCALE).padStart(QUANTITY_DECIMALS, "0")}`;
}

/** A numeric(14,4) value from Postgres ("1.5000") → scaled quantity, exactly. */
export function numericToQuantity(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) throw new RangeError(`Not a stored quantity: ${value}`);
  return Number(match[1]) * QUANTITY_SCALE + Number((match[2] ?? "").padEnd(QUANTITY_DECIMALS, "0"));
}
