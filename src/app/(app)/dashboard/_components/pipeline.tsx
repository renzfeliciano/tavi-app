import type { Route } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { invoiceStatusPresentation, quoteStatusPresentation } from "@/components/status/presentation";
import { cn } from "@/lib/utils";
import type { InvoicePipeline } from "@/modules/invoices";
import type { QuotePipeline } from "@/modules/quotes";
import type { PipelineStage } from "@/shared/pipeline/stage";
import { INK, type Tone } from "./tone";

type Stage = {
  key: string;
  label: string;
  /** What being in this stage means, in a few words. */
  meaning: string;
  icon: LucideIcon;
  /** The ink of the icon and, for overdue, the amounts: only once something is in the stage. */
  tone: Tone;
  href: Route;
  stage: PipelineStage;
};

type Names = { quote: { singular: string; plural: string }; invoice: { singular: string; plural: string } };

function StageLink({ stage, locale }: { stage: Stage; locale: string }) {
  const Icon = stage.icon;
  const lit = stage.stage.count > 0;
  const danger = lit && stage.tone === "danger";
  return (
    <Link
      href={stage.href}
      className="block h-full px-4 py-3.5 outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35 sm:px-5"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", lit ? INK[stage.tone] : INK.muted)} />
        {stage.label}
      </span>
      <span className={cn("mt-2 block text-2xl font-semibold tabular-nums", !lit && "text-muted-foreground")}>{stage.stage.count}</span>
      <span className="mt-0.5 block min-h-4 text-xs text-muted-foreground">
        {stage.stage.totals.map((total) => (
          <MoneyAmount
            key={total.currency}
            amountMinor={total.totalMinor}
            currency={total.currency}
            locale={locale}
            className={cn("block", danger && "font-medium text-danger-strong")}
          />
        ))}
      </span>
      {/* Last, so a meaning that wraps in a narrow cell never pushes the counts out of line with their neighbours'. */}
      <span className="mt-1 block text-xs text-muted-foreground">{stage.meaning}</span>
    </Link>
  );
}

function Row({ id, label, href, stages, locale }: { id: string; label: string; href: Route; stages: Stage[]; locale: string }) {
  return (
    <div role="group" aria-labelledby={id}>
      <h3 className="px-4 pt-3 sm:px-5">
        <Link
          id={id}
          href={href}
          className="inline-flex items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline pointer-coarse:min-h-11"
        >
          {label}
        </Link>
      </h3>
      <ul className={cn("mt-2 grid grid-cols-2 gap-px bg-border", stages.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {stages.map((stage) => (
          <li key={stage.key} className="bg-card max-sm:last:odd:col-span-2">
            <StageLink stage={stage} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Where the work stands: each quotation from draft to approved, each billing statement from draft to overdue, with
 * how many are in a stage and what they are worth (per currency, never added together). Every stage opens the
 * list for it.
 */
export function Pipeline({ quotes, invoices, names, locale }: { quotes: QuotePipeline; invoices: InvoicePipeline; names: Names; locale: string }) {
  const q = quoteStatusPresentation;
  const i = invoiceStatusPresentation;
  const quoteStages: Stage[] = [
    { key: "draft", label: q.DRAFT.label, meaning: "Not sent yet", icon: q.DRAFT.icon, tone: "muted", href: "/quotes?status=draft", stage: quotes.drafts },
    { key: "sent", label: q.SENT.label, meaning: "Not opened yet", icon: q.SENT.icon, tone: "info", href: "/quotes?status=sent", stage: quotes.sent },
    { key: "viewed", label: q.VIEWED.label, meaning: "No answer yet", icon: q.VIEWED.icon, tone: "info", href: "/quotes?status=viewed", stage: quotes.viewed },
    { key: "approved", label: q.APPROVED.label, meaning: "Ready to bill", icon: q.APPROVED.icon, tone: "success", href: "/quotes?status=approved", stage: quotes.approved },
  ];
  // "Unpaid" covers sent and part-paid statements that aren't due yet, so it opens the whole list: one status tab would show fewer rows than the count.
  const invoiceStages: Stage[] = [
    { key: "draft", label: i.DRAFT.label, meaning: "Not sent yet", icon: i.DRAFT.icon, tone: "muted", href: "/invoices?status=draft", stage: invoices.drafts },
    { key: "unpaid", label: i.SENT.label, meaning: "Not due yet", icon: i.SENT.icon, tone: "info", href: "/invoices", stage: invoices.unpaid },
    { key: "overdue", label: i.OVERDUE.label, meaning: "Past due date", icon: i.OVERDUE.icon, tone: "danger", href: "/invoices?status=overdue", stage: invoices.overdue },
  ];

  return (
    <section aria-labelledby="pipeline-heading">
      <h2 id="pipeline-heading" className="text-base font-semibold">
        Pipeline
      </h2>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Row id="pipeline-quotes" label={names.quote.plural} href="/quotes" stages={quoteStages} locale={locale} />
        <Row id="pipeline-invoices" label={names.invoice.plural} href="/invoices" stages={invoiceStages} locale={locale} />
      </div>
    </section>
  );
}
