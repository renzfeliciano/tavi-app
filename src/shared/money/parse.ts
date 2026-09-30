import { currencyExponent, minorToDecimalString } from "./format";

// Reading an amount someone typed, into integer minor units, without ever
// going through a float (§B.2). Separators follow the business's locale
// ("1,250.50" in en-PH, "1.250,50" in de-DE).

/** Largest whole part accepted: 999,999,999,999 in any currency. */
export const MAX_AMOUNT_WHOLE_DIGITS = 12;

const separatorCache = new Map<string, { group: string; decimal: string }>();

function separatorsFor(locale: string) {
  let found = separatorCache.get(locale);
  if (!found) {
    const parts = new Intl.NumberFormat(locale).formatToParts(12_345.6);
    found = {
      group: parts.find((p) => p.type === "group")?.value ?? ",",
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    };
    separatorCache.set(locale, found);
  }
  return found;
}

/**
 * "1,250.50" → 125050 (PHP). Null for anything that isn't a plain,
 * non-negative amount with no more decimals than the currency has.
 */
export function parseMoneyInput(input: string, currency: string, locale: string): number | null {
  const exponent = currencyExponent(currency);
  const { group, decimal } = separatorsFor(locale);

  let text = input.trim().replace(/[\s  ]/g, "");
  if (group.trim() !== "") text = text.split(group).join("");
  if (decimal !== ".") text = text.split(decimal).join(".");

  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || !/\d/.test(text)) return null;
  const whole = (match[1] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = match[2] ?? "";
  if (whole.length > MAX_AMOUNT_WHOLE_DIGITS || fraction.length > exponent) return null;

  return Number(whole || "0") * 10 ** exponent + Number(fraction.padEnd(exponent, "0") || "0");
}

/** Minor units as the business would type them ("1,250.50"), exact: formats the decimal string, not a float. */
export function formatAmountForInput(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyExponent(currency);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    // Intl accepts exact decimal strings (ES2023); the cast bridges the lib typing.
    minorToDecimalString(amountMinor, currency) as unknown as number,
  );
}
