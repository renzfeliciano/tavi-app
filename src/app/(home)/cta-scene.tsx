import { StampImprint } from "@/components/brand/stamp-imprint";
import { StatusBadge } from "@/components/status/status-badge";
import { formatMoney } from "@/shared/money";
import { SAMPLE_BUSINESS, SAMPLE_ITEMS, SAMPLE_NUMBER, SAMPLE_TOTAL_MINOR } from "./sample-quotation";
import { SectionStamp } from "./section-stamp";

// The scene beside the closing words, in place of a Stamp posed in a corner: a
// billing statement that is still owing, and the Stamp, which lowers onto it,
// presses (the statement gives a little), and leaves PAID, then lifts and goes
// again. It plays by itself in CSS (home.css: nothing but opacity and transform,
// and only for people who have not asked for less motion), and answers the
// button beside it (cta-stage.tsx). Without motion it is the stamped, settled
// statement with the Stamp above it. Made-up people and figures from the sample
// quotation; decoration only, since the words beside it say the same thing.

const INVOICE_NUMBER = SAMPLE_NUMBER.replace("QUO", "INV");
const money = (minor: number) => formatMoney(minor, "PHP");

export function CtaScene({ invoice }: { invoice: string }) {
  return (
    <div aria-hidden="true" className="home-cta-scene relative mx-auto h-[23rem] w-full max-w-sm">
      <div data-theme="light" className="home-cta-sheet absolute inset-x-0 bottom-0 grid h-64 content-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <p className="font-heading text-sm font-semibold">{SAMPLE_BUSINESS}</p>
            <p className="text-[0.65rem] text-muted-foreground">General Trias City</p>
          </div>
          <div className="grid justify-items-end gap-0.5 text-right">
            <p className="text-xs font-medium">{invoice}</p>
            <p className="font-mono text-[0.65rem] text-muted-foreground">{INVOICE_NUMBER}</p>
          </div>
        </div>
        <div className="grid gap-1.5 border-t border-border pt-3 text-[0.7rem]">
          {SAMPLE_ITEMS.map((item) => (
            <div key={item.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 tabular-nums">{money(item.amountMinor)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-border-strong pt-3">
          <span className="text-xs font-medium text-muted-foreground">Balance</span>
          <div className="grid justify-items-end">
            <div className="home-cta-before col-start-1 row-start-1 grid justify-items-end gap-1">
              <span className="font-heading text-lg font-semibold tabular-nums">{money(SAMPLE_TOTAL_MINOR)}</span>
              <StatusBadge kind="invoice" status="SENT" />
            </div>
            <div className="home-cta-after col-start-1 row-start-1 grid justify-items-end gap-1">
              <span className="font-heading text-lg font-semibold tabular-nums">{money(0)}</span>
              <StatusBadge kind="invoice" status="PAID" />
            </div>
          </div>
        </div>
        <StampImprint label="Paid" className="home-cta-imprint absolute right-4 bottom-4 bg-card/70" />
      </div>
      <div className="home-cta-stamp absolute top-0 right-8 z-10">
        <SectionStamp expression="celebrating" size="xl" imprint={false} className="h-auto w-24" />
      </div>
    </div>
  );
}
