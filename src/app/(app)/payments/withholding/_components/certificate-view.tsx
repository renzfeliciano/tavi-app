import type { Route } from "next";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, FileTextIcon } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import type { CertificateDetail } from "@/modules/payments";
import { monthNamesOfQuarter, quarterOf } from "@/modules/payments/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { rateText } from "../_lib/form-data";
import { quarterLabel } from "./certificate-list";

const linkClass = "font-medium text-primary-text underline-offset-4 hover:underline";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** A recorded certificate, laid out the way the form reads: payor, period, rows, then what it is checked against. */
export function CertificateView({ detail, locale, certificate }: { detail: CertificateDetail; locale: string; certificate: { name: string; short: string } }) {
  const { short } = certificate;
  const money = (amountMinor: number) => <MoneyAmount amountMinor={amountMinor} currency={detail.currency} locale={locale} />;
  const months = monthNamesOfQuarter(quarterOf(detail.periodFrom).quarter, locale);
  const totalTax = detail.lines.reduce((sum, line) => sum + line.taxWithheldMinor, 0);
  const voided = detail.voidedAt !== null;
  const count = detail.payments.length;
  const payments = `${count} ${count === 1 ? "payment" : "payments"}`;

  return (
    <div className="mt-8 grid max-w-3xl gap-5">
      {voided && (
        <div role="note" aria-label="Void" className="grid gap-1 rounded-xl border border-danger/25 bg-danger-subtle px-5 py-4 text-sm text-danger-strong">
          <p className="font-semibold">This {short} is void.</p>
          {detail.voidReason && <p className="text-pretty">{detail.voidReason}</p>}
        </div>
      )}

      <section aria-labelledby="payor-heading" className="rounded-xl border border-border bg-card shadow-xs">
        <h2 id="payor-heading" className="border-b border-border px-5 py-4 font-semibold sm:px-6">
          Payor
        </h2>
        <dl className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Detail label="Name">{detail.payorName}</Detail>
          <Detail label="TIN">
            <span className="tabular-nums">{detail.payorTin}</span>
          </Detail>
          {detail.payorAddress && (
            <div className="sm:col-span-2">
              <Detail label="Address">{detail.payorAddress}</Detail>
            </div>
          )}
          <Detail label="Period">{`${quarterLabel(detail.periodFrom)} (${formatCalendarDate(detail.periodFrom, locale)} to ${formatCalendarDate(detail.periodTo, locale)})`}</Detail>
          <Detail label="Date received">{formatCalendarDate(detail.receivedOn, locale)}</Detail>
          <Detail label="Customer">
            <Link href={`/customers/${detail.customerId}` as Route} className={linkClass}>
              {detail.customerName}
            </Link>
          </Detail>
        </dl>
      </section>

      <section aria-labelledby="income-heading" className="rounded-xl border border-border bg-card shadow-xs">
        <h2 id="income-heading" className="border-b border-border px-5 py-4 font-semibold sm:px-6">
          Income payments and tax withheld
        </h2>
        <div className="grid gap-5 px-5 py-5 sm:px-6">
          {detail.lines.map((line) => (
            <div key={line.id} role="group" aria-label={line.atcCode} className="grid gap-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold">{line.atcCode}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{`${rateText(line.rateBps)}%`}</span>
                {line.description && <span className="text-sm">{line.description}</span>}
              </p>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {months.map((name, index) => (
                  <div key={name} className="grid gap-0.5">
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd>{money(line.monthMinor[index] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">Total income payments</dt>
                  <dd className="font-medium">{money(line.totalMinor)}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-muted-foreground">Tax withheld</dt>
                  <dd className="font-medium">{money(line.taxWithheldMinor)}</dd>
                </div>
              </dl>
            </div>
          ))}
          <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4 font-semibold">
            <span>Total tax withheld</span>
            {money(totalTax)}
          </p>
        </div>
      </section>

      <section aria-labelledby="payments-heading" className="rounded-xl border border-border bg-card shadow-xs">
        <h2 id="payments-heading" className="border-b border-border px-5 py-4 font-semibold sm:px-6">
          Payments
        </h2>
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          {count > 0 && (
            <ul aria-label={`Payments on this ${short}`} className="grid gap-2 text-sm">
              {detail.payments.map((p) => (
                <li key={p.paymentId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`/payments/${p.paymentId}` as Route} className={linkClass}>
                    {p.receiptNumber}
                  </Link>
                  <span className="text-muted-foreground">{formatCalendarDate(p.paidOn, locale)}</span>
                  {p.invoiceNumber && (
                    <Link href={`/invoices/${p.invoiceId}` as Route} className={linkClass}>
                      {p.invoiceNumber}
                    </Link>
                  )}
                  <span className="ml-auto">{money(p.withheldMinor)}</span>
                </li>
              ))}
            </ul>
          )}
          {!voided &&
            (count === 0 ? (
              <p className="text-sm text-pretty text-muted-foreground">
                No payments are on this {short}, so there is nothing to check it against. It can still cover payments made outside Tavi.
              </p>
            ) : detail.reconciliation.matches ? (
              <p className="flex items-start gap-2 text-sm text-pretty">
                <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                {`Matches the tax withheld on the ${payments} on it.`}
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-pretty">
                <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  Differs by {money(Math.abs(detail.reconciliation.differenceMinor))} from the tax withheld on the {payments} on it. That&apos;s fine if the {short} covers payments made outside Tavi.
                </span>
              </p>
            ))}
        </div>
      </section>

      <section aria-labelledby="scan-heading" className="rounded-xl border border-border bg-card shadow-xs">
        <h2 id="scan-heading" className="border-b border-border px-5 py-4 font-semibold sm:px-6">
          Scan and notes
        </h2>
        <div className="grid gap-4 px-5 py-5 text-sm sm:px-6">
          {detail.fileId ? (
            <p className="flex items-center gap-2">
              <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <a href={`/api/files/${detail.fileId}`} className={linkClass}>
                {detail.fileName ?? "Scan"}
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground">No scan attached.</p>
          )}
          {detail.notes && <p className="text-pretty [overflow-wrap:anywhere]">{detail.notes}</p>}
        </div>
      </section>
    </div>
  );
}
