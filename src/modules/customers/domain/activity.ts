// What "last activity" means for a customer: the latest time something changed on one of their issued
// quotations or billing statements (sent, viewed, approved, paid, corrected). Each module reports its own
// changes; this picks the latest across them and remembers which kind it was.

export type CustomerChange = { customerId: string; at: Date };

/** What the latest change was on. */
export type ActivityKind = "quote" | "invoice";

export type CustomerActivity = { at: Date; kind: ActivityKind };

/**
 * The latest change per customer across sources. When two changes are at the same moment the earlier source
 * wins, so list the source to prefer first.
 */
export function latestActivity(
  sources: readonly { kind: ActivityKind; changes: readonly CustomerChange[] }[],
): Map<string, CustomerActivity> {
  const latest = new Map<string, CustomerActivity>();
  for (const { kind, changes } of sources) {
    for (const { customerId, at } of changes) {
      const known = latest.get(customerId);
      if (!known || at.getTime() > known.at.getTime()) latest.set(customerId, { at, kind });
    }
  }
  return latest;
}
