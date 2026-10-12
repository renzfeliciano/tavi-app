import type { Capability } from "@/modules/authz";

// The recycle bin (D27): a deleted draft quote or bill waits here before it is
// gone for good, so an accidental delete can be undone. Archived customers,
// products, services and tax rates are not here: they stay in their own tables
// (archived, not deleted) and the bin page lists them beside these.

export const TRASH_KINDS = ["invoice", "quote"] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

/** How long a deleted draft is kept before the daily job removes it. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function trashExpiry(deletedAt: Date, days: number = TRASH_RETENTION_DAYS): Date {
  return new Date(deletedAt.getTime() + days * DAY_MS);
}

/** Whole days left, a part day counting as one; zero once it has lapsed. */
export function trashDaysLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS));
}

/** Whoever may write a kind of document may bring a deleted one back. */
export function trashKindCapability(kind: TrashKind): Capability {
  return kind === "invoice" ? "invoices.write" : "quotes.write";
}
