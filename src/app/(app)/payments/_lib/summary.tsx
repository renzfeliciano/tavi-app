import { MoneyAmount } from "@/components/money-amount";
import type { Figure, StripRow } from "@/components/summary-strip";

/** The windows over the Payments list, counted back from today: "since" is `addDays(today, -days)`. */
export const PAYMENT_WINDOWS = [
  { key: "today", label: "Today", days: 0 },
  { key: "week", label: "Last 7 days", days: 7 },
  { key: "month", label: "Last 30 days", days: 30 },
] as const;

export type Received = { currency: string; receivedMinor: number; paymentCount: number };
export type PaymentWindows = Record<(typeof PAYMENT_WINDOWS)[number]["key"], readonly Received[]>;

/** What came in today, over the last week and over the last month, per currency. Plain figures: the list is the detail. */
export function paymentStrip({ windows, locale, currency: own }: { windows: PaymentWindows; locale: string; currency: string }): StripRow[] {
  // The business's own currency is always there, so the strip shows (in zeros) before the first payment.
  const currencies = [...new Set([own, ...Object.values(windows).flatMap((rows) => rows.map((row) => row.currency))])].sort();
  return currencies.map((currency) => ({
    key: currency,
    figures: PAYMENT_WINDOWS.map((window): Figure => {
      const row = windows[window.key].find((r) => r.currency === currency);
      const count = row?.paymentCount ?? 0;
      return {
        key: window.key,
        label: `${window.label}${currencies.length > 1 ? ` (${currency})` : ""}`,
        value: <MoneyAmount amountMinor={row?.receivedMinor ?? 0} currency={currency} locale={locale} />,
        detail: count === 0 ? "No payments" : `${count} ${count === 1 ? "payment" : "payments"}`,
        phone: window.key === "week" ? false : undefined,
      };
    }),
  }));
}
