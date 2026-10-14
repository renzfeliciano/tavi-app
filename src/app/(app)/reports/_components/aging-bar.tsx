import { MoneyAmount } from "@/components/money-amount";

// Unpaid bills as one bar: how much of what is owed is not yet due and how much has waited 1–30, 31–60, 61–90 and
// over 90 days. Ink colours only: a neutral for not yet due, then a warning-to-danger ramp as the wait grows. The legend
// carries every figure, so the bar is never the only way to read it.

export type AgingSlice = { key: string; label: string; amountMinor: number };

/** Not yet due is neutral; each older age steps further from warning toward danger. */
const TONE: Record<string, string> = {
  current: "bg-border-strong",
  "1-30": "bg-warning",
  "31-60": "bg-warning-strong",
  "61-90": "bg-danger",
  "over-90": "bg-danger-strong",
};

/** A segment never draws thinner than this, so a small debt is still seen. */
const MIN_WIDTH_PERCENT = 1;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Whole percent, or "<1%" for an amount too small to round to one. */
function shareText(share: number, amountMinor: number): string {
  const whole = Math.round(share);
  return whole === 0 && amountMinor > 0 ? "<1%" : `${whole}%`;
}

export function AgingBar({ slices, currency, locale }: { slices: AgingSlice[]; currency: string; locale: string }) {
  const total = slices.reduce((sum, s) => sum + s.amountMinor, 0);
  if (total <= 0) return null;

  const shared = slices.map((s) => ({
    ...s,
    share: (s.amountMinor / total) * 100,
  }));
  const drawn = shared.filter((s) => s.amountMinor > 0);
  const summary = drawn.map((s) => `${lowerFirst(s.label)} ${shareText(s.share, s.amountMinor)}`).join(", ");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <h3 className="border-b border-border px-5 py-3 text-sm font-medium sm:px-6">Outstanding by age ({currency})</h3>
      <div className="grid gap-4 px-5 py-4 sm:px-6">
        <div role="img" aria-label={`Outstanding by age: ${summary}`} className="flex h-3 gap-px overflow-hidden rounded-full bg-card">
          {drawn.map((s) => (
            <span
              key={s.key}
              data-segment={s.key}
              className={`h-full ${TONE[s.key] ?? "bg-border-strong"}`}
              style={{
                width: `${Math.max(MIN_WIDTH_PERCENT, Math.round(s.share * 100) / 100)}%`,
              }}
            />
          ))}
        </div>
        <ul aria-label="Outstanding by age" className="grid gap-1.5">
          {shared.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-sm ${TONE[s.key] ?? "bg-border-strong"}`} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <MoneyAmount amountMinor={s.amountMinor} currency={currency} locale={locale} className="shrink-0 font-medium" />
              <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">{shareText(s.share, s.amountMinor)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
