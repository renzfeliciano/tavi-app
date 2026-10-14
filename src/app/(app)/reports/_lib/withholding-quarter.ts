import { type Quarter, quarterOf } from "@/modules/payments/client";
import type { CalendarDate } from "@/shared/dates/calendar";

export type WithholdingQuarterResult = { ok: true; year: number; quarter: Quarter } | { ok: false; error: string };

const FIRST_YEAR = 2000;

/**
 * The year and quarter asked for in a link (`year` and `quarter`, or the Reports page's `wyear` and `wquarter`).
 * Both missing means the current quarter in the business's own day; one without the other, or a value that
 * isn't a year up to next year and a quarter 1 to 4, is refused.
 */
export function parseWithholdingQuarter(year: string | null, quarter: string | null, today: CalendarDate): WithholdingQuarterResult {
  const given = (value: string | null) => (value ?? "").trim();
  if (given(year) === "" && given(quarter) === "") return { ok: true, ...quarterOf(today) };
  const thisYear = quarterOf(today).year;
  if (!/^\d{4}$/.test(given(year)) || Number(given(year)) < FIRST_YEAR || Number(given(year)) > thisYear + 1) {
    return { ok: false, error: "That year isn't one we can show." };
  }
  if (!/^[1-4]$/.test(given(quarter))) return { ok: false, error: "The quarter is 1, 2, 3 or 4." };
  return { ok: true, year: Number(given(year)), quarter: Number(given(quarter)) as Quarter };
}
