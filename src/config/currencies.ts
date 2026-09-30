// Currencies offered in onboarding and settings. Any ISO 4217 code works in
// the money layer; this is only the menu. Names come from Intl, in the
// viewer's language.
export const OFFERED_CURRENCIES = [
  "PHP",
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "AUD",
  "CAD",
  "HKD",
  "JPY",
  "AED",
] as const;

export type CurrencyOption = { code: string; label: string };

/** The menu, labelled like "PHP · Philippine Peso", with `first` (the business's currency) at the top. */
export function currencyOptions({ locale, first }: { locale: string; first: string }): CurrencyOption[] {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  const codes = [first, ...OFFERED_CURRENCIES.filter((code) => code !== first)];
  return codes.map((code) => ({ code, label: `${code} · ${names.of(code) ?? code}` }));
}
