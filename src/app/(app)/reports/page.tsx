import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/form-alert";
import { ListViews } from "@/components/list-controls";
import { MoneyAmount } from "@/components/money-amount";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import {
  AGING_BUCKETS,
  type AgingBucket,
  parseReportPeriod,
  paymentsReport,
  REPORT_PERIODS,
  type ReportPeriod,
  type ReportPeriodPreset,
  salesReport,
  unpaidReport,
} from "@/modules/reports";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";

export const metadata: Metadata = { title: "Reports" };

const PRESET_LABELS: Record<ReportPeriodPreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-quarter": "This quarter",
  "last-quarter": "Last quarter",
  "this-year": "This year",
  "last-year": "Last year",
};

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "over-90": "Over 90 days overdue",
};

/** How many customers each list shows; the CSV has everyone. */
const TOP = 10;

const csvHref = (report: string, period: ReportPeriod) =>
  `/reports/csv?report=${report}&from=${period.from}&to=${period.to}`;

// Reports (2.2c, D18): one period's sales and payments, and today's unpaid
// bills, each per currency and downloadable as a CSV. Owners and admins only.
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = await requireOrgContext();
  if (!can(ctx, "reports.read")) notFound();
  const today = todayIn(ctx.timezone);
  const { period, error } = parseReportPeriod(await searchParams, today);
  const [sales, payments, unpaid, profile] = await Promise.all([
    salesReport(ctx, { period, market: ctx.market }),
    paymentsReport(ctx, { period }),
    unpaidReport(ctx, { today, market: ctx.market }),
    getBusinessProfile(ctx),
  ]);
  const { market, locale } = ctx;
  const seller = market.taxRegistrations.find((r) => r.code === profile.taxRegistration)?.invoiceSales ?? null;
  const salesLabels = market.invoiceRegistration?.sales;
  const date = (d: string) => formatCalendarDate(d, locale);
  const amount = (minor: number, currency: string, className?: string) => (
    <MoneyAmount amountMinor={minor} currency={currency} locale={locale} className={className} />
  );

  return (
    <>
      <PageHeader title="Reports" description="Sales, payments and unpaid bills, ready to send to your accountant." />

      <div className="mt-8 grid gap-4">
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ListViews
            label="Report period"
            views={REPORT_PERIODS.map((preset) => ({
              href: `/reports?period=${preset}` as Route,
              label: PRESET_LABELS[preset],
              current: period.preset === preset,
            }))}
          />
        </div>
        <form action="/reports" className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" name="from" type="date" defaultValue={period.from} required className="w-44" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" name="to" type="date" defaultValue={period.to} required className="w-44" />
          </div>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Show
          </button>
        </form>
        <FormAlert message={error} />
        <p className="text-sm text-muted-foreground">
          {date(period.from)} to {date(period.to)}
        </p>
      </div>

      <ReportSection
        id="sales"
        title="Sales"
        description="Bills issued in this period. Void bills are left out; cancelled ones are shown apart."
        csv={csvHref("sales", period)}
      >
        {sales.summaries.length === 0 ? (
          <Quiet>No bills issued in this period.</Quiet>
        ) : (
          sales.summaries.map((s) => (
            <div key={s.currency} className="grid gap-3">
              <Figures
                items={[
                  { label: `Sales (${countOf(s.issued.count, "bill")})`, value: amount(s.issued.totalMinor, s.currency) },
                  { label: "Before tax", value: amount(s.issued.netMinor, s.currency) },
                  { label: "Tax", value: amount(s.issued.taxMinor, s.currency) },
                ]}
                currency={sales.summaries.length > 1 ? s.currency : null}
              />
              {seller === "vat" && salesLabels && (
                <Rows
                  label={`Sales by tax treatment (${s.currency})`}
                  rows={[
                    [salesLabels.vatable, amount(s.breakdown.vatableMinor, s.currency)],
                    [salesLabels.vat, amount(s.breakdown.vatMinor, s.currency)],
                    [salesLabels.zeroRated, amount(s.breakdown.zeroRatedMinor, s.currency)],
                    [salesLabels.exempt, amount(s.breakdown.exemptMinor, s.currency)],
                  ]}
                />
              )}
              {seller === "percentage_tax" && salesLabels && (
                <Rows
                  label={`Sales by tax treatment (${s.currency})`}
                  rows={[[salesLabels.percentageTax, amount(s.issued.totalMinor, s.currency)]]}
                />
              )}
              {(s.registered.count > 0 || s.cancelled.count > 0) && (
                <p className="text-sm text-muted-foreground">
                  {s.registered.count > 0 && (
                    <>
                      Registered invoices: {countOf(s.registered.count, "bill")},{" "}
                      {amount(s.registered.totalMinor, s.currency, "text-foreground")}.{" "}
                    </>
                  )}
                  {s.cancelled.count > 0 && (
                    <>
                      Cancelled: {countOf(s.cancelled.count, "bill")},{" "}
                      {amount(s.cancelled.totalMinor, s.currency, "text-foreground")}.
                    </>
                  )}
                </p>
              )}
            </div>
          ))
        )}
      </ReportSection>

      <ReportSection
        id="payments"
        title="Payments received"
        description="Money that came in during this period. Voided payments are left out."
        csv={csvHref("payments", period)}
      >
        {payments.summaries.length === 0 ? (
          <Quiet>No payments received in this period.</Quiet>
        ) : (
          payments.summaries.map((s) => (
            <div key={s.currency} className="grid gap-3">
              <Figures
                items={[
                  { label: `Received (${countOf(s.count, "payment")})`, value: amount(s.receivedMinor, s.currency) },
                  ...(market.taxWithheld
                    ? [{ label: market.taxWithheld.label, value: amount(s.withheldMinor, s.currency) }]
                    : []),
                ]}
                currency={payments.summaries.length > 1 ? s.currency : null}
              />
              <Rows
                label={`By method (${s.currency})`}
                rows={s.byMethod.map((m) => [
                  `${market.paymentMethodLabels[m.method as keyof typeof market.paymentMethodLabels] ?? m.method} (${m.count})`,
                  amount(m.receivedMinor, s.currency),
                ])}
              />
              {market.taxWithheld && s.withheldByCustomer.length > 0 && (
                <Rows
                  label={`Tax withheld by customer (${s.currency})`}
                  rows={s.withheldByCustomer.slice(0, TOP).map((c) => [
                    <span key="name">
                      {c.customerName ?? "No customer"}
                      {c.customerTaxId && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {market.taxId.label} {c.customerTaxId}
                        </span>
                      )}
                    </span>,
                    amount(c.withheldMinor, s.currency),
                  ])}
                />
              )}
            </div>
          ))
        )}
      </ReportSection>

      <ReportSection
        id="unpaid"
        title="Unpaid bills"
        description={`What customers still owe today, ${date(today)}, by how long it's been overdue.`}
        csv={csvHref("unpaid", period)}
      >
        {unpaid.summaries.length === 0 ? (
          <Quiet>Nothing unpaid. Every sent bill is settled.</Quiet>
        ) : (
          unpaid.summaries.map((s) => (
            <div key={s.currency} className="grid gap-3">
              <Figures
                items={[
                  { label: `Outstanding (${countOf(s.count, "bill")})`, value: amount(s.outstandingMinor, s.currency) },
                  ...AGING_BUCKETS.map((b) => ({ label: BUCKET_LABELS[b.key], value: amount(s.buckets[b.key], s.currency) })),
                ]}
                currency={unpaid.summaries.length > 1 ? s.currency : null}
              />
              <Rows
                label={`Who owes the most (${s.currency})`}
                rows={s.byCustomer.slice(0, TOP).map((c) => [
                  <span key="name">
                    {c.customerName ?? "No customer"}
                    <span className="text-muted-foreground">
                      {" "}
                      · {countOf(c.count, "bill")} ·{" "}
                      {c.daysOverdue > 0 ? `${countOf(c.daysOverdue, "day")} overdue` : "not yet due"}
                    </span>
                  </span>,
                  amount(c.outstandingMinor, s.currency),
                ])}
              />
            </div>
          ))
        )}
      </ReportSection>
    </>
  );
}

const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function ReportSection({
  id,
  title,
  description,
  csv,
  children,
}: {
  id: string;
  title: string;
  description: string;
  csv: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10 grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-0.5">
          <h2 id={`${id}-heading`} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        <a href={csv} download className={buttonVariants({ variant: "outline" })}>
          <DownloadIcon aria-hidden="true" />
          Download CSV<span className="sr-only"> of {title.toLowerCase()}</span>
        </a>
      </div>
      {children}
    </section>
  );
}

function Figures({ items, currency }: { items: { label: string; value: ReactNode }[]; currency: string | null }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-5 py-4">
          <dt className="text-sm text-muted-foreground">
            {item.label}
            {currency ? ` (${currency})` : ""}
          </dt>
          <dd className="mt-1 text-2xl font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Rows({ label, rows }: { label: string; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <h3 className="border-b border-border px-5 py-3 text-sm font-medium sm:px-6">{label}</h3>
      <dl className="divide-y divide-border">
        {rows.map(([name, value], i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
            <dt className="min-w-0">{name}</dt>
            <dd className="shrink-0 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">{children}</p>
  );
}
