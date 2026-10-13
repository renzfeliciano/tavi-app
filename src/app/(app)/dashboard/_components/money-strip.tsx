import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { cn } from "@/lib/utils";
import type { CalendarDate } from "@/shared/dates/calendar";
import { daysLate, lateLabel } from "@/shared/dates/lateness";
import type { MoneyRow } from "../_lib/money-rows";

const tile =
  "block h-full px-5 py-4 outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35";

/**
 * What is owed, what is late and what came in, one sheet of three tiles per currency. Each tile is a link to the
 * list behind its number, and says how many documents make it up (counts, never an animation: a half-counted
 * figure would be a wrong figure, DESIGN.md).
 */
export function MoneyStrip({
  rows,
  locale,
  today,
  windowDays,
  invoiceNames,
}: {
  rows: readonly MoneyRow[];
  locale: string;
  today: CalendarDate;
  windowDays: number;
  invoiceNames: { singular: string; plural: string };
}) {
  if (rows.length === 0) return null;
  const several = rows.length > 1;
  const noun = (count: number) => `${count} ${(count === 1 ? invoiceNames.singular : invoiceNames.plural).toLowerCase()}`;

  return (
    <section aria-label="Money" className="mt-8 grid gap-3">
      {rows.map((row) => {
        const suffix = several ? ` (${row.currency})` : "";
        const late = row.overdueCount > 0;
        return (
          <ul key={row.currency} className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
            <li className="bg-card">
              <Link href="/invoices" className={tile}>
                <span className="block text-sm text-muted-foreground">Outstanding{suffix}</span>
                <MoneyAmount amountMinor={row.outstandingMinor} currency={row.currency} locale={locale} className="mt-1 block text-2xl font-semibold" />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.outstandingCount > 0 ? noun(row.outstandingCount) : "Nothing owed"}
                </span>
              </Link>
            </li>
            <li className="bg-card">
              <Link href="/invoices?status=overdue" className={tile}>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {late && <CircleAlertIcon aria-hidden="true" className="size-3.5 text-danger-strong" />}
                  Overdue{suffix}
                </span>
                <MoneyAmount
                  amountMinor={row.overdueMinor}
                  currency={row.currency}
                  locale={locale}
                  className={cn("mt-1 block text-2xl font-semibold", late && "text-danger-strong")}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {late
                    ? row.oldestOverdueDue
                      ? `${noun(row.overdueCount)} · oldest ${lateLabel(daysLate(row.oldestOverdueDue, today))}`
                      : noun(row.overdueCount)
                    : "Nothing overdue"}
                </span>
              </Link>
            </li>
            <li className="bg-card">
              <Link href="/payments" className={tile}>
                <span className="block text-sm text-muted-foreground">
                  Paid in the last {windowDays} days{suffix}
                </span>
                <MoneyAmount amountMinor={row.receivedMinor} currency={row.currency} locale={locale} className="mt-1 block text-2xl font-semibold" />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.paymentCount > 0 ? `${row.paymentCount} ${row.paymentCount === 1 ? "payment" : "payments"}` : "No payments yet"}
                </span>
              </Link>
            </li>
          </ul>
        );
      })}
    </section>
  );
}
