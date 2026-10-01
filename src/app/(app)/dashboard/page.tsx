import type { Metadata, Route } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  FilePlus2Icon,
  PencilLineIcon,
  ReceiptTextIcon,
  ThumbsUpIcon,
  UserPlusIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { DocumentNumber } from "@/components/document-number";
import { MoneyAmount } from "@/components/money-amount";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { MarketProfile } from "@/config/markets";
import { cn } from "@/lib/utils";
import { listAuditEvents } from "@/modules/audit";
import { can } from "@/modules/authz";
import { listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { invoiceMoneySummary, overdueInvoices } from "@/modules/invoices";
import { paymentsReceivedSince } from "@/modules/payments";
import { quoteProgress, quotesNeedingAttention } from "@/modules/quotes";
import { addDays, formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { describeActivity } from "./_lib/activity";
import { DASHBOARD_RULES } from "./_lib/rules";
import { timeAgo } from "./_lib/time-ago";

export const metadata: Metadata = { title: "Dashboard" };

const DAY_MS = 86_400_000;

// "What needs my attention?" (§G.2). Until the first quote is sent, a
// three-step checklist takes its place (§G.5); each step is ticked from the
// business's own data.

type Step = { title: string; description: string; href: Route; cta: string; done: boolean };

function setupSteps(market: MarketProfile, progress: { hasCustomer: boolean; hasQuote: boolean; hasSentQuote: boolean }): Step[] {
  return [
    {
      title: "Add your first customer",
      description: "Their name and contact details fill in on every quote and invoice.",
      href: "/customers/new",
      cta: "Add customer",
      done: progress.hasCustomer,
    },
    {
      title: "Create a quote",
      description: `List the work and your price. ${brand.name} does the totals and tax.`,
      href: "/quotes/new",
      cta: "New quote",
      done: progress.hasQuote,
    },
    {
      title: "Send it",
      description: `Email it, or copy the link into ${market.shareChannels}. They can approve it from their phone.`,
      href: "/quotes",
      cta: "Go to quotes",
      done: progress.hasSentQuote,
    },
  ];
}

function Checklist({ steps }: { steps: Step[] }) {
  const next = steps.findIndex((step) => !step.done);
  return (
    <section aria-labelledby="setup-heading" className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
        <BrandMascot expression="happy" size="sm" />
        <div className="grid gap-0.5">
          <h2 id="setup-heading" className="font-semibold">
            Get ready to send your first quote
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Your logo and business details can wait.{" "}
            <Link href="/settings/business" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
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
            </div>
            {step.done ? (
              <span className="col-start-2 inline-flex items-center gap-1 text-sm text-success-strong sm:col-start-3">
                <CircleCheckIcon aria-hidden="true" className="size-4" /> Done
              </span>
            ) : (
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

type AttentionItem = { key: string; icon: ReactNode; label: string; href: Route; title: ReactNode; detail: string; amount?: ReactNode };

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
        <PageHeader title={`Welcome to ${brand.name}`} description="Three steps to your first sent quote." />
        <Checklist steps={setupSteps(market, progress)} />
      </>
    );
  }

  const rules = DASHBOARD_RULES;
  const [attention, overdue, owed, received, events] = await Promise.all([
    quotesNeedingAttention(ctx, {
      today,
      followUpBefore: new Date(now.getTime() - rules.quoteFollowUpDays * DAY_MS),
      staleBefore: new Date(now.getTime() - rules.staleDraftDays * DAY_MS),
      limit: rules.attentionLimit,
    }),
    overdueInvoices(ctx, { today, limit: rules.attentionLimit }),
    invoiceMoneySummary(ctx, { today }),
    can(ctx, "payments.read") ? paymentsReceivedSince(ctx, addDays(today, -rules.paidWindowDays)) : Promise.resolve([]),
    can(ctx, "audit.read") ? listAuditEvents(ctx.organizationId, undefined, 50) : Promise.resolve(null),
  ]);

  const money = (minor: number, currency: string) => <MoneyAmount amountMinor={minor} currency={currency} locale={locale} />;
  const ago = (date: Date | null) => (date ? timeAgo(date, now, locale) : "");

  // Most urgent first: money already late, then money ready to bill, then nudges.
  const items: AttentionItem[] = [
    ...overdue.map((i) => ({
      key: `overdue-${i.id}`,
      icon: <CircleAlertIcon aria-hidden="true" className="size-4 text-danger-strong" />,
      label: "Overdue",
      href: `/invoices/${i.id}` as Route,
      title: <DocumentNumber number={i.number} />,
      detail: `${i.customerName ?? ""} · due ${formatCalendarDate(i.dueDate, locale)}`,
      amount: money(i.balanceMinor, i.currency),
    })),
    ...attention.approvedNotInvoiced.map((q) => ({
      key: `approved-${q.id}`,
      icon: <ThumbsUpIcon aria-hidden="true" className="size-4 text-success-strong" />,
      label: `Approved, ready to bill`,
      href: `/quotes/${q.id}` as Route,
      title: <DocumentNumber number={q.number} />,
      detail: `${q.customerName ?? ""} · approved ${ago(q.since)}`,
      amount: money(q.totalMinor, q.currency),
    })),
    ...attention.awaitingReply.map((q) => ({
      key: `waiting-${q.id}`,
      icon: <ClockIcon aria-hidden="true" className="size-4 text-info-strong" />,
      label: "No answer yet",
      href: `/quotes/${q.id}` as Route,
      title: <DocumentNumber number={q.number} />,
      detail: `${q.customerName ?? ""} · sent ${ago(q.since)}`,
      amount: money(q.totalMinor, q.currency),
    })),
    ...attention.staleDrafts.map((q) => ({
      key: `draft-${q.id}`,
      icon: <PencilLineIcon aria-hidden="true" className="size-4 text-muted-foreground" />,
      label: "Unfinished draft",
      href: `/quotes/${q.id}` as Route,
      title: <span>{q.customerName ?? `Draft ${market.documents.quote.singular.toLowerCase()}`}</span>,
      detail: `last edited ${ago(q.since)}`,
    })),
  ];

  const currencies = [...new Set([...owed.map((o) => o.currency), ...received.map((r) => r.currency)])].sort();
  const activity = (events ?? [])
    .map((event) => ({ event, described: describeActivity(event, market) }))
    .filter((row): row is { event: (typeof row)["event"]; described: NonNullable<(typeof row)["described"]> } => row.described !== null)
    .slice(0, rules.activityLimit);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${ctx.organizationName} · ${formatCalendarDate(today, locale)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/quotes/new" className={buttonVariants()}>
              <FilePlus2Icon aria-hidden="true" />
              New quote
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

      {currencies.length > 0 && (
        <section aria-label="Money" className="mt-8 grid gap-3">
          {currencies.map((currency) => {
            const o = owed.find((row) => row.currency === currency);
            const r = received.find((row) => row.currency === currency);
            const tiles = [
              { label: "Outstanding", value: o?.outstandingMinor ?? 0 },
              { label: "Overdue", value: o?.overdueMinor ?? 0, danger: (o?.overdueMinor ?? 0) > 0 },
              { label: `Paid in the last ${rules.paidWindowDays} days`, value: r?.receivedMinor ?? 0 },
            ];
            return (
              <dl key={currency} className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
                {tiles.map((tile) => (
                  <div key={tile.label} className="bg-card px-5 py-4">
                    <dt className="text-sm text-muted-foreground">
                      {tile.label}
                      {currencies.length > 1 ? ` (${currency})` : ""}
                    </dt>
                    <dd className={cn("mt-1 text-2xl font-semibold", tile.danger && "text-danger-strong")}>
                      {money(tile.value, currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          })}
        </section>
      )}

      <section aria-labelledby="attention-heading" className="mt-10">
        <h2 id="attention-heading" className="text-base font-semibold">
          Needs your attention
        </h2>
        {items.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">
            <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success-strong" />
            <p>You&apos;re all caught up.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {item.icon}
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-sm">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-muted-foreground"> · {item.detail}</span>
                    </span>
                  </span>
                  {item.amount && <span className="text-sm font-medium">{item.amount}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {events !== null && (
        <section aria-labelledby="activity-heading" className="mt-10">
          <h2 id="activity-heading" className="text-base font-semibold">
            Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {activity.map(({ event, described }) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-4">
                  {described.href ? (
                    <Link
                      href={described.href}
                      className="underline-offset-4 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                    >
                      {described.text}
                    </Link>
                  ) : (
                    <span>{described.text}</span>
                  )}
                  <time dateTime={event.createdAt.toISOString()} className="text-muted-foreground">
                    {ago(event.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
