import { formatMoney, minorToDecimalString } from "@/shared/money";
import { cn } from "@/lib/utils";

type MoneyAmountProps = {
  /** Integer minor units (centavos for PHP). */
  amountMinor: number;
  /** ISO 4217 code, e.g. "PHP". */
  currency: string;
  className?: string;
};

/**
 * Displays money. Tabular figures so columns align, never wraps, and never
 * animates: an intermediate figure would be a wrong figure (§H).
 */
export function MoneyAmount({ amountMinor, currency, className }: MoneyAmountProps) {
  return (
    <data
      value={`${minorToDecimalString(amountMinor, currency)} ${currency}`}
      className={cn("tabular-nums whitespace-nowrap", className)}
    >
      {formatMoney(amountMinor, currency)}
    </data>
  );
}
