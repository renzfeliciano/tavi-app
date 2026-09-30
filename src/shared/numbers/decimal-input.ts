// Reading a number someone typed ("1,250.5", "1.250,5", "1.5") into a scaled
// integer, without going through a float. Separators follow the locale.

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

export type DecimalInputOptions = {
  locale: string;
  /** Decimal places kept: the result is the value × 10^scale. More places are refused, never rounded. */
  scale: number;
  /** Largest whole part accepted, in digits. */
  maxWholeDigits: number;
};

/** "1.5" at scale 4 → 15000. Null for anything that isn't a plain, non-negative number. */
export function parseDecimalInput(input: string, { locale, scale, maxWholeDigits }: DecimalInputOptions): number | null {
  const { group, decimal } = separatorsFor(locale);

  let text = input.trim().replace(/[\s  ]/g, "");
  if (group.trim() !== "") text = text.split(group).join("");
  if (decimal !== ".") text = text.split(decimal).join(".");

  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || !/\d/.test(text)) return null;
  const whole = (match[1] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = match[2] ?? "";
  if (whole.length > maxWholeDigits || fraction.length > scale) return null;

  return Number(whole || "0") * 10 ** scale + Number(fraction.padEnd(scale, "0") || "0");
}
