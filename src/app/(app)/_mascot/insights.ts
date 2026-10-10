/**
 * What the Stamp may say (D22). A pipeline, top to bottom:
 *   facts (counted from the database)  ->  insightsFrom  ->  selectInsight  ->  the companion.
 * Every insight is derived from a fact; nothing is guessed. Each rule is a
 * pure function over plain numbers, so it is testable and explainable, and a
 * later AI layer can add providers or reword messages without touching the UI.
 */

export type InsightKind = "critical" | "action" | "recommended" | "informational" | "positive";

/** Most valuable first. Only one insight is shown at a time. */
const KIND_RANK: Record<InsightKind, number> = {
  critical: 0,
  action: 1,
  recommended: 2,
  informational: 3,
  positive: 4,
};

export type MascotInsight = {
  /** Stable, so a dismissal sticks and a resolved item can be noticed. */
  id: string;
  kind: InsightKind;
  message: string;
  action?: { label: string; href: string };
  /** Routes (and their children) where it is relevant; critical ones show anywhere. */
  scopes: string[];
  /** Tie-break inside a kind: higher first. */
  priority: number;
};

type Words = { one: string; other: string };

export type InsightFacts = {
  /** The market's words for documents, lower-case. */
  words: { quote: Words; invoice: Words };
  can: { quotes: boolean; invoices: boolean; payments: boolean; manageBusiness: boolean };
  hasCustomer: boolean;
  hasQuote: boolean;
  hasSentQuote: boolean;
  approvedNotInvoiced: number;
  awaitingReply: number;
  staleDrafts: number;
  overdueInvoices: number;
  receivedToday: boolean;
  /** The business address is filled in. */
  profileComplete: boolean;
};

const noun = (n: number, w: Words) => (n === 1 ? w.one : w.other);
const are = (n: number) => (n === 1 ? "is" : "are");

export function insightsFrom(f: InsightFacts): MascotInsight[] {
  const out: MascotInsight[] = [];
  const add = (i: MascotInsight) => out.push(i);

  // A new business: the next step toward a first sent quote (the same steps as the dashboard checklist).
  if (!f.hasSentQuote && f.can.quotes) {
    // Only on the dashboard: the empty lists below it already carry their own Stamp.
    const front = ["/dashboard"];
    if (!f.hasCustomer) {
      add({ id: "onboarding-customer", kind: "recommended", priority: 90, scopes: front,
        message: "Let's get your first quote out the door. Start by adding a customer.",
        action: { label: "Add customer", href: "/customers/new" } });
    } else if (!f.hasQuote) {
      add({ id: "onboarding-quote", kind: "recommended", priority: 90, scopes: front,
        message: `Nice, you have a customer. Now create your first ${f.words.quote.one}.`,
        action: { label: `New ${f.words.quote.one}`, href: "/quotes/new" } });
    } else {
      add({ id: "onboarding-send", kind: "recommended", priority: 90, scopes: front,
        message: `Your first ${f.words.quote.one} is drafted. Send it and you're set up.`,
        action: { label: "Open quotes", href: "/quotes" } });
    }
  }

  if (f.can.manageBusiness && f.hasCustomer && !f.profileComplete) {
    add({ id: "business-profile", kind: "recommended", priority: 60,
      scopes: ["/dashboard", "/settings", "/quotes", "/invoices"],
      message: `Your business address isn't on your documents yet.`,
      action: { label: "Complete details", href: "/settings/business" } });
  }

  if (f.can.invoices && f.overdueInvoices > 0) {
    add({ id: "overdue", kind: "action", priority: 100, scopes: ["/dashboard", "/invoices", "/payments"],
      message: `${f.overdueInvoices} ${noun(f.overdueInvoices, f.words.invoice)} ${are(f.overdueInvoices)} overdue.`,
      action: { label: `View ${f.words.invoice.other}`, href: "/invoices" } });
  }

  if (f.can.quotes) {
    if (f.approvedNotInvoiced > 0) {
      add({ id: "approved", kind: "action", priority: 90, scopes: ["/dashboard", "/quotes"],
        message: `${f.approvedNotInvoiced} ${noun(f.approvedNotInvoiced, f.words.quote)} ${are(f.approvedNotInvoiced)} approved and ready to bill.`,
        action: { label: `View ${f.words.quote.other}`, href: "/quotes" } });
    }
    if (f.awaitingReply > 0) {
      add({ id: "awaiting-reply", kind: "recommended", priority: 50, scopes: ["/dashboard", "/quotes"],
        message: `${f.awaitingReply} ${noun(f.awaitingReply, f.words.quote)} sent a while ago ${f.awaitingReply === 1 ? "has" : "have"} no answer yet.`,
        action: { label: `View ${f.words.quote.other}`, href: "/quotes" } });
    }
    if (f.staleDrafts > 0) {
      add({ id: "stale-drafts", kind: "recommended", priority: 40, scopes: ["/dashboard", "/quotes"],
        message: `${f.staleDrafts} ${f.staleDrafts === 1 ? "draft hasn't" : "drafts haven't"} been touched in a few days.`,
        action: { label: `View ${f.words.quote.other}`, href: "/quotes" } });
    }
  }

  if (f.can.payments && f.receivedToday) {
    add({ id: "received-today", kind: "positive", priority: 80, scopes: ["/dashboard", "/payments"],
      message: "You received a payment today.",
      action: { label: "View payments", href: "/payments" } });
  }

  if (out.length === 0 && f.hasSentQuote) {
    add({ id: "all-clear", kind: "positive", priority: 10, scopes: ["/dashboard"], message: "Everything is up to date." });
  }
  return out;
}

const inScope = (scope: string, pathname: string) => pathname === scope || pathname.startsWith(`${scope}/`);

/** The one thing worth saying on `pathname`, or nothing. */
export function selectInsight(
  insights: readonly MascotInsight[],
  pathname: string,
  dismissed: ReadonlySet<string>,
): MascotInsight | null {
  const best = insights
    .filter((i) => !dismissed.has(i.id))
    .filter((i) => i.kind === "critical" || i.scopes.some((s) => inScope(s, pathname)))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.priority - a.priority);
  return best[0] ?? null;
}
