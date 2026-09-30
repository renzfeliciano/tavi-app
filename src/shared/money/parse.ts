import { parseDecimalInput } from "@/shared/numbers/decimal-input";
import { currencyExponent, minorToDecimalString } from "./format";

// Reading an amount someone typed, into integer minor units, without ever
// going through a float (§B.2). Separators follow the business's locale
// ("1,250.50" in en-PH, "1.250,50" in de-DE).

/** Largest whole part accepted: 999,999,999,999 in any currency. */
export const MAX_AMOUNT_WHOLE_DIGITS = 12;

/**
 * "1,250.50" → 125050 (PHP). Null for anything that isn't a plain,
 * non-negative amount with no more decimals than the currency has.
 */
export function parseMoneyInput(input: string, currency: string, locale: string): number | null {
  return parseDecimalInput(input, {
    locale,
    scale: currencyExponent(currency),
    maxWholeDigits: MAX_AMOUNT_WHOLE_DIGITS,
  });
}

/** Minor units as the business would type them ("1,250.50"), exact: formats the decimal string, not a float. */
export function formatAmountForInput(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyExponent(currency);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    // Intl accepts exact decimal strings (ES2023); the cast bridges the lib typing.
    minorToDecimalString(amountMinor, currency) as unknown as number,
  );
}
