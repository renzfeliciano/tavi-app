import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/form-alert";
import { ListViews } from "@/components/list-controls";
import { ListForm, ListPending, ListResults } from "@/components/list-pending";
import { MoneyAmount } from "@/components/money-amount";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/config/brand";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { withholdingReport } from "@/modules/payments";
import {
  AGING_BUCKETS,
  type AgingBucket,
  parseReportPeriod,
  paymentsReport,
  previousPeriod,
  REPORT_PERIODS,
  type ReportPeriod,
  type ReportPeriodPreset,
  salesReport,
  unpaidReport,
} from "@/modules/reports";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { AgingBar } from "./_components/aging-bar";
import { Compared, Figures } from "./_components/report-figures";
import { Quiet, ReportSection, Rows } from "./_components/report-parts";
import { ReportSectionsSkeleton } from "./_components/report-sections-skeleton";
import { WithholdingSection } from "./_components/withholding-section";
import { parseWithholdingQuarter } from "./_lib/withholding-quarter";

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
  const query = await searchParams;
  const { period, error } = parseReportPeriod(query, today);
  const before = previousPeriod(period);
  // The 2307 section has its own year and quarter (a quarter's certificates, whatever period the page shows).
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const asked = parseWithholdingQuarter(first(query.wyear), first(query.wquarter), today);
  const withheldQuarter = asked.ok ? asked : parseWithholdingQuarter(null, null, today);
  const [sales, payments, unpaid, profile, salesBefore, paymentsBefore, withheld] = await Promise.all([
    salesReport(ctx, { period, market: ctx.market }),
    paymentsReport(ctx, { period }),
    unpaidReport(ctx, { today, market: ctx.market }),
    getBusinessProfile(ctx),
    salesReport(ctx, { period: before, market: ctx.market }),
    paymentsReport(ctx, { period: before }),
    ctx.market.taxWithheld && withheldQuarter.ok
      ? withholdingReport(ctx, { year: withheldQuarter.year, quarter: withheldQuarter.quarter })
      : null,
  ]);
  const { market, locale } = ctx;
  const statement = market.documents.invoice.singular.toLowerCase();
  const statements = market.documents.invoice.plural.toLowerCase();
  const seller = market.taxRegistrations.find((r) => r.code === profile.taxRegistration)?.invoiceSales ?? null;
  const salesLabels = market.invoiceRegistration?.sales;
  const date = (d: string) => formatCalendarDate(d, locale);
  const amount = (minor: number, currency: string, className?: string) => (
    <MoneyAmount amountMinor={minor} currency={currency} locale={locale} className={className} />
  );

  return (
    <>
      <PageHeader title="Reports" description={`Sales, payments and unpaid ${statements}, ready to send to your accountant.`} />

      <ListPending>
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
          <ListForm action="/reports" className="flex flex-wrap items-end gap-3">
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
          </ListForm>
          <FormAlert message={error} />
          <p className="text-sm text-muted-foreground">
            {date(period.from)} to {date(period.to)}
          </p>
        </div>

        <ListResults label="Loading reports" skeleton={<ReportSectionsSkeleton withholding={Boolean(market.taxWithheld)} />}>
          <ReportSection
            id="sales"
            title="Sales"
            description={`${capital(statements)} issued in this period. Void ones are left out; cancelled ones are shown apart.`}
            csv={csvHref("sales", period)}
          >
            {sales.rows.some((r) => r.registered) && (
              // D19: registered invoices as structured data for the BIR's e-invoicing system.
              <p className="text-sm text-pretty text-muted-foreground">
                <a
                  href={`/reports/e-invoices?from=${period.from}&to=${period.to}`}
                  download
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Download e-invoices (JSON)
                </a>{" "}
                for this period&apos;s registered invoices, ready for e-invoicing. {brand.name} isn&apos;t BIR-certified for e-invoicing yet,
                so the file is for your records and your accountant.
              </p>
            )}
            {sales.summaries.length === 0 ? (
              <Quiet>No {statements} issued in this period.</Quiet>
            ) : (
              sales.summaries.map((s) => (
                <div key={s.currency} className="grid gap-3">
                  <Figures
                    items={[
                      { label: `Sales (${countOf(s.issued.count, statement)})`, value: amount(s.issued.totalMinor, s.currency) },
                      { label: "Before tax", value: amount(s.issued.netMinor, s.currency) },
                      { label: "Tax", value: amount(s.issued.taxMinor, s.currency) },
                    ]}
                    currency={sales.summaries.length > 1 ? s.currency : null}
                  />
                  <Compared
                    now={s.issued.totalMinor}
                    before={salesBefore.summaries.find((x) => x.currency === s.currency)?.issued.totalMinor ?? 0}
                    format={(minor) => amount(minor, s.currency)}
                    label={periodWord(period)}
                  />
                  {seller === "vat" && salesLabels && (
                    <Rows
                      label={`Sales by tax treatment (${s.currency})`}
                      rows={[
                        [salesLabels.vatable, amount(s.breakdown.vatableMinor, s.currency)],
                        [salesLabels.vat, amount(s.breakdown.vatMinor, s.currency)],
                        [salesLabels.zeroRated, amount(s.breakdown.zeroRatedMinor, s.currency)],
                        [salesLabels.exempt, amount(s.breakdown.exemptMinor, s.currency)],
                        // Sales are shown before qualified buyers' discounts (D19), so those come off here.
                        ...(s.breakdown.qualifiedDiscountMinor > 0
                          ? [["Less: special discounts", amount(s.breakdown.qualifiedDiscountMinor, s.currency)] as [ReactNode, ReactNode]]
                          : []),
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
                          Registered invoices: {countOf(s.registered.count, statement)},{" "}
                          {amount(s.registered.totalMinor, s.currency, "text-foreground")}.{" "}
                        </>
                      )}
                      {s.cancelled.count > 0 && (
                        <>
                          Cancelled: {countOf(s.cancelled.count, statement)},{" "}
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
                  <Compared
                    now={s.receivedMinor}
                    before={paymentsBefore.summaries.find((x) => x.currency === s.currency)?.receivedMinor ?? 0}
                    format={(minor) => amount(minor, s.currency)}
                    label={periodWord(period)}
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
            title={`Unpaid ${statements}`}
            description={`What customers still owe today, ${date(today)}, by how long it's been overdue.`}
            csv={csvHref("unpaid", period)}
          >
            {unpaid.summaries.length === 0 ? (
              <Quiet>Nothing unpaid. Every sent {statement} is settled.</Quiet>
            ) : (
              unpaid.summaries.map((s) => (
                <div key={s.currency} className="grid gap-3">
                  <Figures
                    items={[
                      { label: `Outstanding (${countOf(s.count, statement)})`, value: amount(s.outstandingMinor, s.currency) },
                      ...AGING_BUCKETS.map((b) => ({ label: BUCKET_LABELS[b.key], value: amount(s.buckets[b.key], s.currency) })),
                    ]}
                    currency={unpaid.summaries.length > 1 ? s.currency : null}
                  />
                  <AgingBar
                    slices={AGING_BUCKETS.map((b) => ({ key: b.key, label: BUCKET_LABELS[b.key], amountMinor: s.buckets[b.key] }))}
                    currency={s.currency}
                    locale={locale}
                  />
                  <Rows
                    label={`Who owes the most (${s.currency})`}
                    rows={s.byCustomer.slice(0, TOP).map((c) => [
                      <span key="name">
                        {c.customerName ?? "No customer"}
                        <span className="text-muted-foreground">
                          {" "}
                          · {countOf(c.count, statement)} ·{" "}
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

          {withheld && market.taxWithheld && withheldQuarter.ok && (
            <WithholdingSection
              report={withheld}
              locale={locale}
              certificate={market.taxWithheld.certificate}
              taxIdLabel={market.taxId.label}
              years={withholdingYears(today, withheldQuarter.year)}
              carry={period.preset ? { period: period.preset } : { from: period.from, to: period.to }}
              csv={`/reports/csv?report=withholding&year=${withheldQuarter.year}&quarter=${withheldQuarter.quarter}`}
              error={asked.ok ? null : asked.error}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}

/** What to call the period before this one: "last month" for a month, otherwise "the previous period". */
const periodWord = (period: ReportPeriod) =>
  period.preset === "this-month" || period.preset === "last-month"
    ? "the month before"
    : period.preset === "this-quarter" || period.preset === "last-quarter"
      ? "the quarter before"
      : period.preset === "this-year" || period.preset === "last-year"
        ? "the year before"
        : "the previous period";

/** The years the 2307 picker offers: this year and four before it, plus the one being shown. */
const withholdingYears = (today: string, shown: number) => {
  const thisYear = Number(today.slice(0, 4));
  return [...new Set([...Array.from({ length: 5 }, (_, i) => thisYear - i), shown])].sort((a, b) => b - a);
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
