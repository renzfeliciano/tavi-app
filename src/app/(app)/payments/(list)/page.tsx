import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DocumentNumber } from "@/components/document-number";
import { ListPager, listHref, pageParam } from "@/components/list-controls";
import { MoneyAmount } from "@/components/money-amount";
import { requireOrgContext } from "@/modules/identity";
import { listPayments } from "@/modules/payments";
import { formatCalendarDate } from "@/shared/dates/calendar";

export const metadata: Metadata = { title: "Payments" };

// Money received across all invoices, newest first. A payment is recorded
// from its invoice (it needs the balance), so the empty state points there.
export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const ctx = await requireOrgContext();
  const { market } = ctx;
  const page = pageParam((await searchParams).page);
  const list = await listPayments(ctx, { page });
  const description = "Money you've received, across all invoices.";
  const invoices = market.documents.invoice.plural.toLowerCase();

  if (list.total === 0) {
    return (
      <>
        <PageHeader title="Payments" description={description} />
        <SectionEmpty
          title="No payments recorded yet"
          description={`When a customer pays by ${market.paymentMethods}, open their ${market.documents.invoice.singular.toLowerCase()} and record it there. It updates itself.`}
          action={{ href: "/invoices", label: `Go to ${invoices}`, icon: ReceiptTextIcon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Payments" description={description} />
      <section aria-label="Payment list" className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <ul className="divide-y divide-border">
          {list.payments.map((payment) => (
            <li key={payment.id}>
              <Link
                href={`/payments/${payment.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block text-sm">
                    <DocumentNumber number={payment.receiptNumber} />
                    {payment.voidedAt && <span className="text-muted-foreground"> · Voided</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatCalendarDate(payment.paidOn, ctx.locale)} · {market.paymentMethodLabels[payment.method]}
                  </span>
                </span>
                <MoneyAmount
                  amountMinor={payment.amountMinor}
                  currency={payment.currency}
                  locale={ctx.locale}
                  className={payment.voidedAt ? "text-muted-foreground line-through" : "font-medium"}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => listHref("/payments", { page: p > 1 ? p : null })} />
    </>
  );
}
