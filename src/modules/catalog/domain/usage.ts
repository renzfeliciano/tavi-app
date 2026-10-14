import { type CalendarDate, compareDates } from "@/shared/dates/calendar";

// How much a product or service has been used: on how many issued documents, and the day of the latest one.
// Quotations and billing statements each report their own; this puts them together.

/** One kind of document's report for one item: how many of its issued documents carry the item, and the latest day. */
export type ItemUse = { itemId: string; count: number; lastOn: CalendarDate };

/** What an item's use comes to across every kind of document. */
export type ItemUseTotal = { count: number; lastOn: CalendarDate };

/** Each item's total across the reports. An item no report mentions has no entry: it was never used. */
export function mergeUse(reports: readonly (readonly ItemUse[])[]): Map<string, ItemUseTotal> {
  const totals = new Map<string, ItemUseTotal>();
  for (const report of reports) {
    for (const { itemId, count, lastOn } of report) {
      const known = totals.get(itemId);
      totals.set(itemId, {
        count: (known?.count ?? 0) + count,
        lastOn: known && compareDates(known.lastOn, lastOn) >= 0 ? known.lastOn : lastOn,
      });
    }
  }
  return totals;
}
