import type { Metadata, Route } from "next";
import Link from "next/link";
import { FileCheck2Icon, ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { SummaryStrip } from "@/components/summary-strip";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { listPayments, paymentsReceivedSince, paymentWithholdingStatus } from "@/modules/payments";
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
  // "2307 pending" shows only the payments still waiting for their certificate (markets with no withheld tax have none).
  const certificate = market.taxWithheld?.certificate.short ?? null;
  const pendingOnly = certificate !== null && params.withholding === "pending";
  const since = (days: number) => paymentsReceivedSince(ctx, addDays(today, -days));
  const [list, received, week, month] = await Promise.all([
    listPayments(ctx, {
      search,
      page: pageParam(params.page),
      pageSize: parsePageSize(params.size),
      ...(pendingOnly ? { withholding: "pending" as const } : {}),
    }),
    since(PAYMENT_WINDOWS[0].days),
    since(PAYMENT_WINDOWS[1].days),
    since(PAYMENT_WINDOWS[2].days),
  ]);
  const statuses = certificate ? await paymentWithholdingStatus(ctx, list.payments.map((payment) => payment.id)) : undefined;
  const withholdingParam = pendingOnly ? "pending" : null;
  const paymentsHref = (q: string | null, withholding: "pending" | null) =>
    listHref("/payments", { q, withholding, size: sizeParam(list.pageSize) });
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
      <PageHeader
        title="Payments"
        description={description}
        actions={
          certificate && (
            <Link href={"/payments/withholding" as Route} className={buttonVariants({ variant: "outline" })}>
              <FileCheck2Icon aria-hidden="true" />
              Withholding ({certificate})
            </Link>
          )
        }
      />
      <SummaryStrip label="Payment summary" rows={strip} />
      <ListPending>
        <div className={certificate ? "mt-5 grid gap-3" : "mt-5"}>
          <ListSearch
            action="/payments"
            label="Search payments"
            placeholder="Customer, receipt, reference or number"
            value={search}
            keep={{ size: keptSize(list.pageSize), withholding: withholdingParam ?? undefined }}
          />
          {certificate && (
            <div className="-mx-4 overflow-x-auto px-4 pb-1">
              <ListViews
                label="Payments by 2307 status"
                views={[
                  { href: paymentsHref(search, null), label: "All", current: !pendingOnly },
                  { href: paymentsHref(search, "pending"), label: `${certificate} pending`, current: pendingOnly },
                ]}
              />
            </div>
          )}
        </div>

        <ListResults label="Loading payments" skeleton={<PaymentListSkeleton />}>
          {list.payments.length === 0 ? (
            <section aria-label="Payment list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No payments match “${search}”` : `Nothing is waiting for a ${certificate}`}
                description={
                  search
                    ? "Try the customer's name, the receipt number or the reference you wrote down."
                    : `Every payment with tax withheld has its ${market.taxWithheld?.certificate.name ?? "certificate"} recorded.`
                }
                action={
                  <Link href={paymentsHref(null, null)} className={buttonVariants({ variant: "outline" })}>
                    {search ? "Clear search" : "Show all payments"}
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label="Payment list"
              columns={paymentColumns(ctx.locale, market, statuses)}
              rows={list.payments}
              rowKey={(payment) => payment.id}
              rowHref={(payment) => `/payments/${payment.id}` as Route}
              phoneSummary={paymentSummary(ctx.locale, market)}
              controls={certificate ? 2 : 1}
              strip
              meta={list}
              noun={{ singular: "payment", plural: "payments" }}
              hrefFor={pagedHref("/payments", { q: search, withholding: withholdingParam }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
