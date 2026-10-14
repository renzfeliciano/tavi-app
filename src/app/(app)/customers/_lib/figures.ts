import type { ActivityKind, CustomerActivity, CustomerSummary } from "@/modules/customers";
import type { CustomerMoney } from "@/modules/invoices";
import { type CalendarDate, todayIn } from "@/shared/dates/calendar";
import { recentDay } from "@/shared/dates/recent-day";

// What the Customers list shows beside each customer: what they still owe and when anything last
// happened with them. The queries answer per currency and in instants; this turns them into what
// a row needs.

/** One currency a customer still owes in. Never summed across currencies (§B.2). */
export type Owing = { currency: string; owedMinor: number; overdueMinor: number };

/** The day (in the business's time zone) something last changed, how to say it ("Yesterday"), and on what. */
export type Activity = { on: CalendarDate; when: string; kind: ActivityKind };

export type CustomerRow = CustomerSummary & { owing: Owing[]; activity: Activity | null };

/** What one customer still owes: each currency with a balance, none for a customer who has paid up. */
export function owingFrom(money: readonly CustomerMoney[]): Owing[] {
  return money
    .filter((row) => row.owedMinor > 0)
    .map(({ currency, owedMinor, overdueMinor }) => ({ currency, owedMinor, overdueMinor }));
}

/** The listed customers with their money and last activity, in the order they came. */
export function customerRows({
  customers,
  money,
  changes,
  timezone,
  today,
  locale,
}: {
  customers: readonly CustomerSummary[];
  money: readonly CustomerMoney[];
  changes: ReadonlyMap<string, CustomerActivity>;
  timezone: string;
  today: CalendarDate;
  locale: string;
}): CustomerRow[] {
  const moneyOf = Map.groupBy(money, (row) => row.customerId);
  return customers.map((customer) => {
    const change = changes.get(customer.id);
    const on = change ? todayIn(timezone, change.at) : null;
    return {
      ...customer,
      owing: owingFrom(moneyOf.get(customer.id) ?? []),
      activity: change && on ? { on, when: recentDay(on, today, locale), kind: change.kind } : null,
    };
  });
}
