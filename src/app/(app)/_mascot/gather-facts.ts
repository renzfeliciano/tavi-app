import { can } from "@/modules/authz";
import { listCustomers } from "@/modules/customers";
import type { OrgContext } from "@/modules/identity";
import { overdueInvoices } from "@/modules/invoices";
import { getBusinessProfile } from "@/modules/organizations";
import { paymentsReceivedSince } from "@/modules/payments";
import { quoteProgress, quotesNeedingAttention } from "@/modules/quotes";
import { todayIn } from "@/shared/dates/calendar";
import { DASHBOARD_RULES } from "../dashboard/_lib/rules";
import type { InsightFacts } from "./insights";

const DAY_MS = 86_400_000;
/** Counted up to here; more than this is just "many". */
const COUNT_CAP = 50;

/**
 * Counts what the business has, with the same rules and thresholds as the
 * dashboard (DASHBOARD_RULES), so the Stamp and the dashboard never disagree.
 * Reads only what the person's role may read.
 */
export async function gatherFacts(ctx: OrgContext, now: Date = new Date()): Promise<InsightFacts> {
  const allow = {
    quotes: can(ctx, "quotes.read"),
    invoices: can(ctx, "invoices.read"),
    payments: can(ctx, "payments.read"),
    manageBusiness: can(ctx, "organization.manage"),
  };
  const today = todayIn(ctx.timezone, now);
  const rules = DASHBOARD_RULES;
  const { quote, invoice } = ctx.market.documents;

  const [customers, progress, attention, overdue, received, profile] = await Promise.all([
    can(ctx, "customers.read") ? listCustomers(ctx, {}) : Promise.resolve(null),
    allow.quotes ? quoteProgress(ctx) : Promise.resolve({ hasQuote: false, hasSentQuote: false }),
    allow.quotes
      ? quotesNeedingAttention(ctx, {
          today,
          followUpBefore: new Date(now.getTime() - rules.quoteFollowUpDays * DAY_MS),
          staleBefore: new Date(now.getTime() - rules.staleDraftDays * DAY_MS),
          limit: COUNT_CAP,
        })
      : Promise.resolve(null),
    allow.invoices ? overdueInvoices(ctx, { today, limit: COUNT_CAP }) : Promise.resolve([]),
    allow.payments ? paymentsReceivedSince(ctx, today) : Promise.resolve([]),
    allow.manageBusiness ? getBusinessProfile(ctx) : Promise.resolve(null),
  ]);

  return {
    words: {
      quote: { one: quote.singular.toLowerCase(), other: quote.plural.toLowerCase() },
      invoice: { one: invoice.singular.toLowerCase(), other: invoice.plural.toLowerCase() },
    },
    can: allow,
    hasCustomer: (customers?.customers.length ?? 0) > 0,
    hasQuote: progress.hasQuote,
    hasSentQuote: progress.hasSentQuote,
    approvedNotInvoiced: attention?.approvedNotInvoiced.length ?? 0,
    awaitingReply: attention?.awaitingReply.length ?? 0,
    staleDrafts: attention?.staleDrafts.length ?? 0,
    overdueInvoices: overdue.length,
    receivedToday: received.length > 0,
    profileComplete: profile ? Boolean(profile.addressLine1 && profile.city) : true,
  };
}
