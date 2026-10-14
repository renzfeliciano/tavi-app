import type { CatalogItem, ItemUseTotal } from "@/modules/catalog";
import { type CalendarDate } from "@/shared/dates/calendar";
import { recentDay } from "@/shared/dates/recent-day";

// What the catalog list shows beside each product or service: when it was last put on a sent quotation or
// issued billing statement, and how often. The queries answer per item and in calendar days; this turns them
// into what a row needs.

/** How an item has been used, in words a row can show. */
export type ItemUseView = { count: number; when: string };

export type CatalogRow = CatalogItem & { use: ItemUseView | null };

export const usedTimes = (count: number) => (count === 1 ? "Used once" : `Used ${count} times`);

/** The listed items with their use, in the order they came. An item no document carries has none. */
export function catalogRows({
  items,
  usage,
  today,
  locale,
}: {
  items: readonly CatalogItem[];
  usage: ReadonlyMap<string, ItemUseTotal>;
  today: CalendarDate;
  locale: string;
}): CatalogRow[] {
  return items.map((item) => {
    const total = usage.get(item.id);
    return { ...item, use: total ? { count: total.count, when: recentDay(total.lastOn, today, locale) } : null };
  });
}
