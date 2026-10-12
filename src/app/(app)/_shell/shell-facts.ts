import { cache } from "react";
import type { ShellFacts } from "@/components/app-shell/facts";
import { QUIET_NOTE } from "@/components/app-shell/facts";
import { can } from "@/modules/authz";
import type { OrgContext } from "@/modules/identity";
import { countOverdueInvoices, invoiceMoneySummary } from "@/modules/invoices";
import { getBusinessRegistration, upcomingDeadlines } from "@/modules/organizations";
import { countDraftQuotes } from "@/modules/quotes";
import { todayIn } from "@/shared/dates/calendar";
import { gatherFacts } from "../_mascot/gather-facts";
import { INSIGHT_MOOD, insightsFrom, topInsight } from "../_mascot/insights";

/** A return or renewal this close (or already past) is worth a line in the sidebar. */
const DEADLINE_NOTICE_DAYS = 30;

/** Runs one lookup; a failure leaves that figure out rather than the whole sidebar. */
async function attempt<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

/**
 * The sidebar's facts, counted with the same rules as the dashboard and the
 * Stamp's insights, for what this person's role may read. Cached per request;
 * the sidebar streams it in beside the page, so nothing waits on it.
 */
export const loadShellFacts = cache(async (ctx: OrgContext, now: Date = new Date()): Promise<ShellFacts> => {
  const today = todayIn(ctx.timezone, now);
  const [overdueCount, draftCount, unpaid, deadline, note] = await Promise.all([
    can(ctx, "invoices.read") ? attempt(() => countOverdueInvoices(ctx, { today }), null) : null,
    can(ctx, "quotes.read") ? attempt(() => countDraftQuotes(ctx), null) : null,
    can(ctx, "invoices.read") ? attempt(() => invoiceMoneySummary(ctx, { today }), null) : null,
    can(ctx, "organization.manage") ? attempt(() => nextDeadline(ctx, today), null) : null,
    attempt(async () => {
      const insight = topInsight(insightsFrom(await gatherFacts(ctx, now)));
      return insight
        ? { mood: INSIGHT_MOOD[insight.kind], message: insight.message, action: insight.action ?? null }
        : QUIET_NOTE;
    }, QUIET_NOTE),
  ]);
  return { overdueCount, draftCount, unpaid: unpaid?.filter((m) => m.outstandingMinor > 0) ?? null, deadline, note };
});

async function nextDeadline(ctx: OrgContext, today: string): Promise<ShellFacts["deadline"]> {
  const config = ctx.market.registration;
  if (!config) return null;
  const registration = await getBusinessRegistration(ctx);
  const [next] = upcomingDeadlines(config, registration, today, { limit: 1 });
  if (!next || next.daysLeft > DEADLINE_NOTICE_DAYS) return null;
  return { title: next.form ? `${next.form} due` : next.name, daysLeft: next.daysLeft, href: "/settings/registration" };
}
