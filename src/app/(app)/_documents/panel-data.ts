import type { CustomerSnapshot } from "@/modules/quotes";

// What the side panel on an issued quotation or billing statement shows, worked out as plain data so the page
// only has to lay it out: who the document is for, its dates, what has happened to it, and what it came from.

/** Who the document was issued to, as it was issued, and where their record is if it still exists. */
export type PanelCustomer = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  href: string | null;
};

/** One dated line: Date, Due, Valid until. The note says how near it is; `danger` is for a statement past due. */
export type PanelFact = { key: string; label: string; value: string; note?: string; danger?: boolean };

/** One thing that happened to the document, already dated for the reader. */
export type PanelEvent = { key: string; label: string; on: string; detail?: string };

export type PanelLink = { key: string; label: string; href: string };

export type DocumentPanelData = {
  customer: PanelCustomer | null;
  facts: PanelFact[];
  events: PanelEvent[];
  related: PanelLink[];
};

export function panelCustomer(snapshot: CustomerSnapshot | null, customerId: string | null): PanelCustomer | null {
  if (!snapshot) return null;
  return {
    name: snapshot.displayName,
    company: snapshot.company,
    email: snapshot.email,
    phone: snapshot.phone,
    href: customerId ? `/customers/${customerId}` : null,
  };
}

/** Something that may have happened: `at` is null when it hasn't, and `detail` is a reason or note that goes with it. */
export type ActivityCandidate = { key: string; label: string; at: Date | null; detail?: string | null };

/** What has happened, oldest first. What hasn't happened is left out; events at the same moment keep their order. */
export function activity(candidates: ActivityCandidate[], format: (at: Date) => string): PanelEvent[] {
  return candidates
    .flatMap((candidate) => (candidate.at ? [{ ...candidate, at: candidate.at }] : []))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ key, label, at, detail }) => {
      const event: PanelEvent = { key, label, on: format(at) };
      const note = detail?.trim();
      return note ? { ...event, detail: note } : event;
    });
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** How near a statement's due date is, from today: negative days are past due. */
export function dueNote(days: number): string {
  if (days > 1) return `in ${plural(days, "day")}`;
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  return `${plural(-days, "day")} overdue`;
}

/** How long a quotation stays open, from today: negative days have already gone by. */
export function validNote(days: number): string {
  if (days > 0) return `${plural(days, "day")} left`;
  if (days === 0) return "last day";
  if (days === -1) return "expired yesterday";
  return `expired ${plural(-days, "day")} ago`;
}

/** A moment as the panel dates an event: "Oct 1, 2026, 9:00 AM", in the business's own time zone. */
export function momentFormat(locale: string, timezone: string): (at: Date) => string {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  return (at) => format.format(at);
}
