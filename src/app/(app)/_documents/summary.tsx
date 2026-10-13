import { MoneyAmount } from "@/components/money-amount";
import { quoteStatusPresentation } from "@/components/status/presentation";
import type { Figure, StripRow } from "@/components/summary-strip";
import type { InvoiceMoney, InvoicePipeline } from "@/modules/invoices";
import type { QuotePipeline } from "@/modules/quotes";
import type { CalendarDate } from "@/shared/dates/calendar";
import { daysLate, lateLabel } from "@/shared/dates/lateness";
import type { PipelineStage } from "@/shared/pipeline/stage";

// The figures over the Quotations and Billing statements lists: what the list adds up to, per currency, each one
// opening the tab it counts. Built from the same numbers as the dashboard's pipeline.

type Names = { singular: string; plural: string };

const noun = (count: number, names: Names) => `${count} ${(count === 1 ? names.singular : names.plural).toLowerCase()}`;
/** The currencies in play, the business's own always among them so the strip is there (in zeros) before anything is. */
const currenciesOf = (own: string, ...stages: readonly PipelineStage[]) =>
  [...new Set([own, ...stages.flatMap((stage) => stage.totals.map((total) => total.currency))])].sort();

/** Sent, viewed and approved quotations: what is out with customers and what is won and waiting to be billed. */
export function quoteStrip(pipeline: QuotePipeline, names: Names, { locale, currency: own }: { locale: string; currency: string }): StripRow[] {
  const currencies = currenciesOf(own, pipeline.sent, pipeline.viewed, pipeline.approved);
  const presentation = quoteStatusPresentation;
  return currencies.map((currency) => {
    const suffix = currencies.length > 1 ? ` (${currency})` : "";
    const figure = (key: string, label: string, stage: PipelineStage, href: Figure["href"], extra: Partial<Figure> = {}, ending = ""): Figure => {
      const total = stage.totals.find((t) => t.currency === currency);
      return {
        key,
        label: `${label}${suffix}`,
        value: <MoneyAmount amountMinor={total?.totalMinor ?? 0} currency={currency} locale={locale} />,
        detail: total ? `${noun(total.count, names)}${ending}` : "None",
        href,
        ...extra,
      };
    };
    return {
      key: currency,
      figures: [
        figure("sent", presentation.SENT.label, pipeline.sent, "/quotes?status=sent"),
        figure("viewed", presentation.VIEWED.label, pipeline.viewed, "/quotes?status=viewed", { phone: false }),
        figure("approved", presentation.APPROVED.label, pipeline.approved, "/quotes?status=approved", {}, " to bill"),
      ],
    };
  });
}

/** Outstanding, overdue and draft billing statements. Overdue is judged by due date, like the dashboard. */
export function invoiceStrip({
  money,
  drafts,
  names,
  today,
  locale,
  currency: own,
}: {
  money: readonly InvoiceMoney[];
  drafts: InvoicePipeline["drafts"];
  names: Names;
  today: CalendarDate;
  locale: string;
  /** The business's own currency. */
  currency: string;
}): StripRow[] {
  const currencies = [...new Set([...money.map((row) => row.currency), ...currenciesOf(own, drafts)])].sort();
  return currencies.map((currency) => {
    const suffix = currencies.length > 1 ? ` (${currency})` : "";
    const owed = money.find((row) => row.currency === currency);
    const draft = drafts.totals.find((total) => total.currency === currency);
    const late = (owed?.overdueCount ?? 0) > 0;
    const amount = (minor: number) => <MoneyAmount amountMinor={minor} currency={currency} locale={locale} />;
    return {
      key: currency,
      figures: [
        {
          key: "outstanding",
          label: `Outstanding${suffix}`,
          value: amount(owed?.outstandingMinor ?? 0),
          detail: owed && owed.outstandingCount > 0 ? noun(owed.outstandingCount, names) : "Nothing owed",
          href: "/invoices",
        },
        {
          key: "overdue",
          label: `Overdue${suffix}`,
          value: amount(owed?.overdueMinor ?? 0),
          detail:
            late && owed
              ? owed.oldestOverdueDue
                ? `${noun(owed.overdueCount, names)} · oldest ${lateLabel(daysLate(owed.oldestOverdueDue, today))}`
                : noun(owed.overdueCount, names)
              : "Nothing overdue",
          tone: late ? "danger" : undefined,
          href: "/invoices?status=overdue",
        },
        {
          key: "drafts",
          label: `Drafts${suffix}`,
          value: amount(draft?.totalMinor ?? 0),
          detail: draft ? noun(draft.count, names) : "None",
          href: "/invoices?status=draft",
          phone: false,
        },
      ],
    };
  });
}
