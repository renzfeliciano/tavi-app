import type { MascotExpression } from "@/components/brand/brand-mascot";

/**
 * What the sidebar knows about the business today: real counts from the
 * database, nothing invented. A figure is null when the person's role can't
 * read it, or when counting it failed (the sidebar then simply leaves it out).
 */
export type ShellFacts = {
  /** Billing statements owed and past due. */
  overdueCount: number | null;
  /** Quotations still drafts. */
  draftCount: number | null;
  /** What's still owed, per currency (never summed across currencies). */
  unpaid: { currency: string; outstandingMinor: number; overdueMinor: number }[] | null;
  /** The next return or renewal, when it is within a month (or already past). */
  deadline: { title: string; daysLeft: number; href: string } | null;
  /** The one thing the Stamp has to say, and how it looks saying it. */
  note: { mood: MascotExpression; message: string; action: { label: string; href: string } | null };
};

/** What the Stamp says when the data has nothing to say, or couldn't be read. */
export const QUIET_NOTE: ShellFacts["note"] = { mood: "resting", message: "All quiet for now.", action: null };

/** The Stamp's note for a business that has no work yet: the first step, not a blank box. */
export function noteFor(facts: ShellFacts | null): ShellFacts["note"] {
  return facts?.note ?? QUIET_NOTE;
}
