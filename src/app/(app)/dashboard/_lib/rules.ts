/** What the dashboard calls "needs attention" and how far the money strip looks back (§G.2). */
export const DASHBOARD_RULES = {
  /** A sent quote with no answer after this many days gets a nudge. */
  quoteFollowUpDays: 7,
  /** A draft untouched for this many days gets a nudge. */
  staleDraftDays: 3,
  /** "Paid in the last N days" on the money strip. */
  paidWindowDays: 30,
  /** At most this many items per kind in "Needs attention". */
  attentionLimit: 5,
  /** Entries in "Recent activity". */
  activityLimit: 8,
} as const;
