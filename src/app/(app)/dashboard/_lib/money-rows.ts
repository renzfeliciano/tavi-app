import type { InvoiceMoney } from "@/modules/invoices";

export type Received = { currency: string; receivedMinor: number; paymentCount: number };

export type MoneyRow = InvoiceMoney & { receivedMinor: number; paymentCount: number };

/** What is owed and what came in, side by side per currency (never added across currencies, §B.2). */
export function moneyRows(owed: readonly InvoiceMoney[], received: readonly Received[]): MoneyRow[] {
  const currencies = [...new Set([...owed.map((o) => o.currency), ...received.map((r) => r.currency)])].sort();
  return currencies.map((currency) => {
    const o = owed.find((row) => row.currency === currency);
    const r = received.find((row) => row.currency === currency);
    return {
      currency,
      outstandingMinor: o?.outstandingMinor ?? 0,
      outstandingCount: o?.outstandingCount ?? 0,
      overdueMinor: o?.overdueMinor ?? 0,
      overdueCount: o?.overdueCount ?? 0,
      oldestOverdueDue: o?.oldestOverdueDue ?? null,
      receivedMinor: r?.receivedMinor ?? 0,
      paymentCount: r?.paymentCount ?? 0,
    };
  });
}
