import { MoneyAmount } from "@/components/money-amount";

/** How much of a bill is paid, 0 to 100: never 0 once anything is paid and never 100 before it is all paid. */
export function paidShare(paidMinor: number, totalMinor: number): number {
  if (totalMinor <= 0 || paidMinor <= 0) return 0;
  if (paidMinor >= totalMinor) return 100;
  return Math.min(99, Math.max(1, Math.floor((paidMinor / totalMinor) * 100)));
}

/** "₱1,000.00 of ₱3,000.00" under a thin bar. The words say it; the bar only draws it. */
export function PaidProgress({
  paidMinor,
  totalMinor,
  currency,
  locale,
}: {
  paidMinor: number;
  totalMinor: number;
  currency: string;
  locale?: string;
}) {
  return (
    <div className="grid gap-1">
      <div data-slot="paid-progress-bar" aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${paidShare(paidMinor, totalMinor)}%` }} />
      </div>
      <p className="text-xs whitespace-nowrap text-muted-foreground">
        <MoneyAmount amountMinor={paidMinor} currency={currency} locale={locale} className="text-foreground" /> of{" "}
        <MoneyAmount amountMinor={totalMinor} currency={currency} locale={locale} />
      </p>
    </div>
  );
}
