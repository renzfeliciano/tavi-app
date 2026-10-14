import { FormAlert } from "@/components/form-alert";
import { ListForm } from "@/components/list-pending";
import { MoneyAmount } from "@/components/money-amount";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { WithholdingReport } from "@/modules/payments";
import { monthNamesOfQuarter } from "@/modules/payments/client";
import { Figures } from "./report-figures";
import { Quiet, ReportSection, Rows } from "./report-parts";

type WithholdingSectionProps = {
  report: WithholdingReport;
  locale: string;
  certificate: { name: string; short: string };
  taxIdLabel: string;
  years: readonly number[];
  /** The page's own period, kept in the picker's form so choosing a quarter doesn't change it. */
  carry: Record<string, string>;
  csv: string;
  /** Why the quarter asked for in the link was not used. */
  error?: string | null;
};

const rateText = (bps: number) => String(bps / 100);

/**
 * Creditable tax withheld, by calendar quarter and payor (PH: the 2307s the business holds). The quarter is chosen
 * apart from the page's period. Certificates still to arrive are listed apart and never added into the totals.
 */
export function WithholdingSection({ report, locale, certificate, taxIdLabel, years, carry, csv, error }: WithholdingSectionProps) {
  const { short } = certificate;
  const quarter = `Q${report.quarter} ${report.year}`;
  const amount = (minor: number, currency: string) => <MoneyAmount amountMinor={minor} currency={currency} locale={locale} />;
  const manyCurrencies = report.totals.length > 1;

  return (
    <ReportSection
      id="withholding"
      title={`Creditable tax withheld (${short})`}
      description={`The ${certificate.name} certificates your customers sent for ${quarter}, by payor. Payments still waiting for one are shown apart and not counted.`}
      csv={csv}
    >
      <ListForm action="/reports" className="flex flex-wrap items-end gap-3">
        {Object.entries(carry).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="grid gap-2">
          <Label htmlFor="withholding-year">Year</Label>
          <NativeSelect id="withholding-year" name="wyear" defaultValue={String(report.year)} className="w-28">
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="withholding-quarter">Quarter</Label>
          <NativeSelect id="withholding-quarter" name="wquarter" defaultValue={String(report.quarter)} className="w-56">
            {([1, 2, 3, 4] as const).map((q) => {
              const months = monthNamesOfQuarter(q, locale);
              return (
                <option key={q} value={String(q)}>{`Q${q}: ${months[0]} to ${months[2]}`}</option>
              );
            })}
          </NativeSelect>
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Show
        </button>
      </ListForm>
      <FormAlert message={error} />

      {report.received.length === 0 ? (
        <Quiet>
          No {short} certificates received for {quarter}.
        </Quiet>
      ) : (
        <>
          {report.totals.map((total) => (
            <Figures
              key={total.currency}
              items={[
                { label: "Income payments", value: amount(total.incomeMinor, total.currency) },
                { label: "Tax withheld", value: amount(total.taxWithheldMinor, total.currency) },
              ]}
              currency={manyCurrencies ? total.currency : null}
            />
          ))}
          {report.received.map((payor) => (
            <Rows
              key={`${payor.payorTin}-${payor.currency}`}
              label={`${payor.payorName} · ${taxIdLabel} ${payor.payorTin}`}
              rows={payor.lines.map((line) => [
                <span key={line.atcCode}>
                  {line.atcCode}{" "}
                  <span className="text-muted-foreground">
                    · {rateText(line.rateBps)}% · {line.certificateCount} {line.certificateCount === 1 ? "certificate" : "certificates"} · income{" "}
                    {amount(line.incomeMinor, payor.currency)}
                  </span>
                </span>,
                amount(line.taxWithheldMinor, payor.currency),
              ])}
            />
          ))}
        </>
      )}

      {report.waiting.length > 0 && (
        <Rows
          label={`Still waiting for ${short}`}
          rows={report.waiting.map((group) => [
            <span key={`${group.customerId}-${group.currency}`}>
              {group.customerName}
              <span className="text-muted-foreground">
                {" "}
                · {group.paymentCount} {group.paymentCount === 1 ? "payment" : "payments"}
              </span>
            </span>,
            amount(group.withheldMinor, group.currency),
          ])}
        />
      )}
    </ReportSection>
  );
}
