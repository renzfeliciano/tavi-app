// Money display. Amounts are always integers in minor units (centavos, cents)
// plus an ISO 4217 code (docs/foundation-proposal.md §B.2). This module only
// formats; arithmetic lives in the calculation engine.

const DEFAULT_LOCALE = "en-PH";

const SUPPORTED_CURRENCIES: ReadonlySet<string> = new Set(
  Intl.supportedValuesOf("currency"),
);

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** True for a real, uppercase ISO 4217 code that Intl can format. */
export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && SUPPORTED_CURRENCIES.has(code);
}

function assertCurrency(currency: string): void {
  if (!isCurrencyCode(currency)) {
    throw new RangeError(`Unsupported currency: ${currency}`);
  }
}

/** Number of minor-unit digits for a currency (PHP 2, JPY 0, KWD 3). */
export function currencyExponent(currency: string): number {
  assertCurrency(currency);
  return formatterFor("en", currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Exact decimal string for an integer minor-unit amount ("123.45"), so display
 * never goes through floating-point division.
 */
export function minorToDecimalString(
  amountMinor: number,
  currency: string,
): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(
      `Money amounts must be safe integers in minor units; received ${amountMinor}`,
    );
  }
  return toDecimalString(amountMinor, currencyExponent(currency));
}

function toDecimalString(amountMinor: number, exponent: number): string {
  const negative = amountMinor < 0;
  const digits = Math.abs(amountMinor).toString();
  if (exponent === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(exponent + 1, "0");
  const whole = padded.slice(0, -exponent);
  const fraction = padded.slice(-exponent);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Formats integer minor units for display, e.g. `formatMoney(840000, "PHP")`
 * gives "₱8,400.00". Throws on fractional or unsafe amounts and unknown
 * currencies, because either one means a bug upstream.
 */
export function formatMoney(
  amountMinor: number,
  currency: string,
  options: { locale?: string } = {},
): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(
      `Money amounts must be safe integers in minor units; received ${amountMinor}`,
    );
  }
  const exponent = currencyExponent(currency);
  const locale = options.locale ?? DEFAULT_LOCALE;
  // Intl.NumberFormat accepts exact decimal strings (ES2023), avoiding floats.
  // The cast bridges TypeScript's `format(number | bigint)` lib typing.
  return formatterFor(locale, currency).format(
    toDecimalString(amountMinor, exponent) as unknown as number,
  );
}
