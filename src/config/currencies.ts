// Currencies offered in onboarding and settings. PHP first: Philippines-first
// launch (D2). Any ISO 4217 code works in the money layer; this is the menu.
export const CURRENCIES = [
  ["PHP", "Philippine peso (₱)"],
  ["USD", "US dollar ($)"],
  ["EUR", "Euro (€)"],
  ["GBP", "British pound (£)"],
  ["SGD", "Singapore dollar"],
  ["AUD", "Australian dollar"],
  ["CAD", "Canadian dollar"],
  ["HKD", "Hong Kong dollar"],
  ["JPY", "Japanese yen (¥)"],
  ["AED", "UAE dirham"],
] as const;
