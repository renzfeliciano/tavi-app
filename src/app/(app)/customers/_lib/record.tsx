import { MoneyAmount } from "@/components/money-amount";
import type { Figure, StripRow } from "@/components/summary-strip";
import type { MarketProfile } from "@/config/markets";
import type { CustomerMoney } from "@/modules/invoices";
import { formatMoney } from "@/shared/money";

/**
 * What a customer owes, has been billed and has paid, one row per currency (never summed across currencies).
 * Plain figures: the lists under the strip are the detail. The business's own currency is always there, so
 * the strip shows (in zeros) before the first billing statement.
 */
export function customerStrip({
  money,
  locale,
  currency: own,
  market,
}: {
  money: readonly CustomerMoney[];
  locale: string;
  currency: string;
  market: Pick<MarketProfile, "documents">;
}): StripRow[] {
  const noun = market.documents.invoice;
  const currencies = money.length > 0 ? money.map((row) => row.currency) : [own];
  return currencies.map((currency) => {
    const row = money.find((m) => m.currency === currency);
    const [billed, paid, owed, overdue, count] = [
      row?.billedMinor ?? 0,
      row?.paidMinor ?? 0,
      row?.owedMinor ?? 0,
      row?.overdueMinor ?? 0,
      row?.count ?? 0,
    ];
    const suffix = currencies.length > 1 ? ` (${currency})` : "";
    // 100% only when it is all paid, and never 0% once something has been: a rounded figure must not hide what is owed.
    const share = billed === 0 ? 0 : paid >= billed ? 100 : Math.min(99, Math.round((paid / billed) * 100));
    return {
      key: currency,
      figures: [
        {
          key: "owed",
          label: `Owed${suffix}`,
          value: <MoneyAmount amountMinor={owed} currency={currency} locale={locale} />,
          detail: overdue > 0 ? `${formatMoney(overdue, currency, { locale })} overdue` : owed > 0 ? "Not due yet" : "Nothing owed",
          tone: overdue > 0 ? "danger" : undefined,
        },
        {
          key: "billed",
          label: `Billed${suffix}`,
          value: <MoneyAmount amountMinor={billed} currency={currency} locale={locale} />,
          detail:
            count === 0
              ? `No ${noun.plural.toLowerCase()} yet`
              : `${count} ${(count === 1 ? noun.singular : noun.plural).toLowerCase()}`,
        },
        {
          key: "paid",
          label: `Paid${suffix}`,
          value: <MoneyAmount amountMinor={paid} currency={currency} locale={locale} />,
          detail: paid > 0 ? `${share < 1 ? "Under 1" : share}% of billed` : "Nothing paid yet",
          phone: false,
        },
      ] satisfies Figure[],
    };
  });
}
