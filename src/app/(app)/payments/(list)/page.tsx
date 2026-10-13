import type { Metadata, Route } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { SummaryStrip } from "@/components/summary-strip";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { listPayments, paymentsReceivedSince } from "@/modules/payments";
import { addDays, todayIn } from "@/shared/dates/calendar";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { PaymentListSkeleton, paymentColumns, paymentSummary } from "../_components/payment-list";
import { PAYMENT_WINDOWS, paymentStrip } from "../_lib/summary";

export const metadata: Metadata = { title: "Payments" };

// Money received across all billing statements, newest first. A payment is recorded
// from its billing statement (it needs the balance), so the empty state points there.
export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const ctx = await requireOrgContext();
  const { market } = ctx;
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const today = todayIn(ctx.timezone);
  const since = (days: number) => paymentsReceivedSince(ctx, addDays(today, -days));
  const [list, received, week, month] = await Promise.all([
    listPayments(ctx, { search, page: pageParam(params.page), pageSize: parsePageSize(params.size) }),
    since(PAYMENT_WINDOWS[0].days),
    since(PAYMENT_WINDOWS[1].days),
    since(PAYMENT_WINDOWS[2].days),
  ]);
  const strip = paymentStrip({ windows: { today: received, week, month }, locale: ctx.locale, currency: ctx.currency });
  const invoices = market.documents.invoice.plural.toLowerCase();
  const description = `Money you've received, across all ${invoices}.`;

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
      <SummaryStrip label="Payment summary" rows={strip} />
      <ListPending>
        <div className="mt-5">
          <ListSearch
            action="/payments"
            label="Search payments"
            placeholder="Customer, receipt, reference or number"
            value={search}
            keep={{ size: keptSize(list.pageSize) }}
          />
        </div>

        <ListResults label="Loading payments" skeleton={<PaymentListSkeleton />}>
          {list.payments.length === 0 ? (
            <section aria-label="Payment list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={`No payments match “${search}”`}
                description="Try the customer's name, the receipt number or the reference you wrote down."
                action={
                  <Link
                    href={listHref("/payments", { size: sizeParam(list.pageSize) })}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Clear search
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label="Payment list"
              columns={paymentColumns(ctx.locale, market)}
              rows={list.payments}
              rowKey={(payment) => payment.id}
              rowHref={(payment) => `/payments/${payment.id}` as Route}
              phoneSummary={paymentSummary(ctx.locale, market)}
              strip
              meta={list}
              noun={{ singular: "payment", plural: "payments" }}
              hrefFor={pagedHref("/payments", { q: search }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
