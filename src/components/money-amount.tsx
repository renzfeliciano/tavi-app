import { formatMoney, minorToDecimalString } from "@/shared/money";
import { cn } from "@/lib/utils";

type MoneyAmountProps = {
  /** Integer minor units (centavos for PHP). */
  amountMinor: number;
  /** ISO 4217 code, e.g. "PHP". */
  currency: string;
  /** The business's locale (`ctx.locale`); defaults to the launch market's. */
  locale?: string;
  className?: string;
};

/**
 * Displays money. Tabular figures so columns align, never wraps, and never
 * animates: an intermediate figure would be a wrong figure (§H).
 */
export function MoneyAmount({ amountMinor, currency, locale, className }: MoneyAmountProps) {
  return (
    <data
      value={`${minorToDecimalString(amountMinor, currency)} ${currency}`}
      className={cn("tabular-nums whitespace-nowrap", className)}
    >
      {formatMoney(amountMinor, currency, { locale })}
    </data>
  );
}
