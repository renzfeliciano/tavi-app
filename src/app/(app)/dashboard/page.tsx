import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRightIcon, CircleCheckIcon, FilePlus2Icon, ReceiptTextIcon, UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { MarketProfile } from "@/config/markets";
import { cn } from "@/lib/utils";
import { listAuditEvents } from "@/modules/audit";
import { can } from "@/modules/authz";
import { listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { invoiceMoneySummary, invoicePipeline, overdueInvoices } from "@/modules/invoices";
import { paymentsReceivedSince } from "@/modules/payments";
import { quotePipeline, quoteProgress, quotesNeedingAttention } from "@/modules/quotes";
import { addDays, formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { ActivityFeed, type FeedEntry } from "./_components/activity-feed";
import { AttentionList } from "./_components/attention-list";
import { MoneyStrip } from "./_components/money-strip";
import { Pipeline } from "./_components/pipeline";
import { describeActivity } from "./_lib/activity";
import { attentionItems } from "./_lib/attention-items";
import { groupByDay } from "./_lib/group-by-day";
import { moneyRows } from "./_lib/money-rows";
import { DASHBOARD_RULES } from "./_lib/rules";

export const metadata: Metadata = { title: "Dashboard" };

const DAY_MS = 86_400_000;

// "What needs my attention?" (§G.2). Until the first quote is sent, a
// three-step checklist takes its place (§G.5); each step is ticked from the
// business's own data.

type Step = {
  title: string;
  description: string;
  href: Route;
  cta: string;
  done: boolean;
  /** Why this step can't be finished yet, from the business's own state. */
  blocked?: string;
};

function setupSteps(
  market: MarketProfile,
  progress: { hasCustomer: boolean; hasQuote: boolean; hasSentQuote: boolean },
  emailVerified: boolean,
): Step[] {
  const quote = market.documents.quote.singular.toLowerCase();
  return [
    {
      title: "Add your first customer",
      description: `Their name and contact details fill in on every ${quote} and ${market.documents.invoice.singular.toLowerCase()}.`,
      href: "/customers/new",
      cta: "Add customer",
      done: progress.hasCustomer,
    },
    {
      title: `Create a ${quote}`,
      description: `List the work and your price. ${brand.name} does the totals and tax.`,
      href: "/quotes/new",
      cta: `New ${quote}`,
      done: progress.hasQuote,
    },
    {
      title: "Send it",
      description: `Email it, or copy the link into ${market.shareChannels}. They can approve it from their phone.`,
      href: "/quotes",
      cta: `Go to ${market.documents.quote.plural.toLowerCase()}`,
      done: progress.hasSentQuote,
      blocked: !progress.hasQuote
        ? `Create a ${quote} first.`
        : !emailVerified
          ? "Confirm your email first. Use the link we sent, or resend it above."
          : undefined,
    },
  ];
}

function Checklist({ steps, quoteName }: { steps: Step[]; quoteName: string }) {
  const next = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <section aria-labelledby="setup-heading" className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="grid gap-0.5">
          <h2 id="setup-heading" className="font-semibold">
            Get ready to send your first {quoteName}
          </h2>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {doneCount} of {steps.length} done
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            Your logo and business details can wait.{" "}
            <Link href="/settings/business" className="font-medium text-foreground underline underline-offset-4 hover:text-primary-text">
              Add them now
            </Link>
          </p>
        </div>
      </div>
      <ol className="divide-y divide-border">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
          >
            <span
              aria-hidden="true"
              className={cn(
                "row-span-2 mt-px grid size-7 shrink-0 place-items-center self-start rounded-full border font-mono text-xs tabular-nums sm:row-span-1 sm:mt-0 sm:self-center",
                step.done
                  ? "border-success bg-success-subtle text-success-strong"
                  : index === next
                    ? "border-stamp bg-stamp-subtle text-stamp"
                    : "border-border-strong text-muted-foreground",
              )}
            >
              {step.done ? <CircleCheckIcon className="size-4" /> : index + 1}
            </span>
            <div className="grid gap-0.5">
              <span className={cn("font-medium", step.done && "text-muted-foreground line-through")}>
                <span className="sr-only">
                  Step {index + 1}
                  {step.done ? " (done)" : ""}:{" "}
                </span>
                {step.title}
              </span>
              <span className="text-sm text-pretty text-muted-foreground">{step.description}</span>
              {!step.done && step.blocked && (
                <span className="text-sm text-pretty text-warning-strong">{step.blocked}</span>
              )}
            </div>
            {step.done ? (
              <span className="col-start-2 inline-flex items-center gap-1 text-sm text-success-strong sm:col-start-3">
                <CircleCheckIcon aria-hidden="true" className="size-4" /> Done
              </span>
            ) : step.blocked ? null : (
              <Link
                href={step.href}
                className={cn(
                  buttonVariants({ variant: index === next ? "default" : "outline" }),
                  "col-start-2 justify-self-start sm:col-start-3",
                )}
              >
                {step.cta}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const { market, locale } = ctx;
  const now = new Date();
  const today = todayIn(ctx.timezone, now);

  const [customers, quotes] = await Promise.all([listCustomers(ctx, {}), quoteProgress(ctx)]);
  const progress = { hasCustomer: customers.customers.length > 0, ...quotes };
  if (!progress.hasSentQuote) {
    return (
      <>
        <PageHeader title={`Welcome to ${brand.name}`} description={`Three steps to your first sent ${market.documents.quote.singular.toLowerCase()}.`} />
        <Checklist steps={setupSteps(market, progress, ctx.emailVerified)} quoteName={market.documents.quote.singular.toLowerCase()} />
      </>
    );
  }

  const rules = DASHBOARD_RULES;
  const [attention, overdue, owed, received, quotePipelines, invoicePipelines, events] = await Promise.all([
    quotesNeedingAttention(ctx, {
      today,
      followUpBefore: new Date(now.getTime() - rules.quoteFollowUpDays * DAY_MS),
      staleBefore: new Date(now.getTime() - rules.staleDraftDays * DAY_MS),
      limit: rules.attentionLimit,
    }),
    overdueInvoices(ctx, { today, limit: rules.attentionLimit }),
    invoiceMoneySummary(ctx, { today }),
    can(ctx, "payments.read") ? paymentsReceivedSince(ctx, addDays(today, -rules.paidWindowDays)) : Promise.resolve([]),
    quotePipeline(ctx),
    invoicePipeline(ctx, { today }),
    can(ctx, "audit.read") ? listAuditEvents(ctx.organizationId, undefined, 50) : Promise.resolve(null),
  ]);

  const items = attentionItems({ overdue, quotes: attention, today, now, locale, quoteName: market.documents.quote.singular });
  const entries = (events ?? []).flatMap((event): FeedEntry[] => {
    const described = describeActivity(event, market);
    return described ? [{ id: event.id, createdAt: event.createdAt, ...described }] : [];
  });
  const days = groupByDay(entries.slice(0, rules.activityLimit), { today, timezone: ctx.timezone, locale });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${ctx.organizationName} · ${formatCalendarDate(today, locale)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/quotes/new" className={buttonVariants()}>
              <FilePlus2Icon aria-hidden="true" />
              New {market.documents.quote.singular.toLowerCase()}
            </Link>
            <Link href="/invoices/new" className={buttonVariants({ variant: "outline" })}>
              <ReceiptTextIcon aria-hidden="true" />
              New {market.documents.invoice.singular.toLowerCase()}
            </Link>
            <Link href="/customers/new" className={buttonVariants({ variant: "outline" })}>
              <UserPlusIcon aria-hidden="true" />
              Add customer
            </Link>
          </div>
        }
      />

      <MoneyStrip
        rows={moneyRows(owed, received)}
        locale={locale}
        today={today}
        windowDays={rules.paidWindowDays}
        invoiceNames={market.documents.invoice}
      />

      {/* What to do and where the work stands, beside what just happened (only for people who can read the audit log). */}
      <div className={cn("mt-10 grid gap-10", events !== null && "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-8")}>
        <div className="grid gap-10">
          <AttentionList items={items} locale={locale} />
          <Pipeline quotes={quotePipelines} invoices={invoicePipelines} names={market.documents} locale={locale} />
        </div>
        {events !== null && <ActivityFeed groups={days} locale={locale} timeZone={ctx.timezone} />}
      </div>
    </>
  );
}
