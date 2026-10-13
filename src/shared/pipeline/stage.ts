// A stage of the dashboard's pipeline: how many documents are in it, and what
// they are worth in each currency (with each currency's own count). Currencies are never added together (§B.2).

export type PipelineStage = {
  count: number;
  totals: { currency: string; count: number; totalMinor: number }[];
};

export const EMPTY_STAGE: PipelineStage = { count: 0, totals: [] };

/** A stage from one row per currency (rows with nothing in them are left out). */
export function stageFrom(rows: readonly { currency: string; count: number; totalMinor: number }[]): PipelineStage {
  const present = rows.filter((row) => row.count > 0);
  return {
    count: present.reduce((sum, row) => sum + row.count, 0),
    totals: present
      .map(({ currency, count, totalMinor }) => ({ currency, count, totalMinor }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
