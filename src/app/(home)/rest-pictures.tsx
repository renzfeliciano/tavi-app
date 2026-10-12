import { CheckIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/shared/money";
import { SAMPLE_DOWNPAYMENT_MINOR, SAMPLE_ITEMS, SAMPLE_TOTAL_MINOR } from "./sample-quotation";

// Six small pictures, one beside each row of "And the rest of the job". Each
// plays on its own, in CSS alone (home.css: nothing but opacity and transform,
// looping, and only for people who have not asked for less motion), so none of
// them needs a script or costs the page anything while it is off screen. What
// they draw here is the frame they rest on when nothing moves. Made-up figures
// from the sample quotation, always light like the paper they stand for, and
// decoration only: the words beside each one say the same thing.

const FRAME = "grid h-[4.25rem] w-40 content-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card p-2.5 text-[0.65rem] text-foreground shadow-sm";
const money = (minor: number) => formatMoney(minor, "PHP");
/** One more revision of the sample quotation: the customer asked for a change, and the total moved. */
const REVISED_TOTAL_MINOR = 480_000;

/** A downpayment, then the rest: the bar fills to half, then to full, and the words change to match. */
export function PartPaymentPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="grid">
        <span className="home-pay-a col-start-1 row-start-1 flex items-baseline justify-between gap-2 font-medium">
          Partly paid <span className="tabular-nums">{money(SAMPLE_DOWNPAYMENT_MINOR)}</span>
        </span>
        <span className="home-pay-b col-start-1 row-start-1 flex items-baseline justify-between gap-2 font-medium text-success-strong">
          Paid <span className="tabular-nums">{money(SAMPLE_TOTAL_MINOR)}</span>
        </span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <span className="home-pay-fill block h-full w-full rounded-full bg-stamp" />
      </span>
    </div>
  );
}

const QR_CELLS = [0, 2, 3, 5, 6, 9, 10, 12, 15];

/** A payment code being read, and the Paid that lights up when it has been. */
export function ScanToPayPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="flex items-center justify-between gap-2">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-sm border border-border p-0.5">
          <span className="grid size-full grid-cols-4 gap-px">
            {Array.from({ length: 16 }, (_, i) =>
              QR_CELLS.includes(i) ? <span key={i} data-cell className="bg-foreground" /> : <span key={i} />,
            )}
          </span>
          <span className="home-qr-line absolute inset-x-0 top-0 h-px bg-stamp shadow-[0_0_6px_1px] shadow-stamp/60" />
        </span>
        <span className="home-flash inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-1 font-semibold text-success-strong">
          <CheckIcon className="size-3" strokeWidth={3} />
          Paid
        </span>
      </div>
    </div>
  );
}

const BARS = [40, 65, 50, 85, 100];

/** A report as a CSV: five bars that grow, one after another, and keep going. */
export function ReportPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="flex items-end justify-between gap-2">
        <span className="flex h-9 items-end gap-1">
          {BARS.map((height, index) => (
            <span key={index} className="home-grow w-2 rounded-sm bg-stamp/80" style={{ height: `${height}%`, "--i": index } as React.CSSProperties} />
          ))}
        </span>
        <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold tracking-wide text-background">CSV</span>
      </div>
    </div>
  );
}

/** A customer typed in, and a price from the list. */
export function CustomerPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="flex items-center gap-1.5">
        <span className="size-4 shrink-0 rounded-full bg-stamp-subtle" />
        <span className="relative overflow-hidden font-medium">
          Juan Dela Cruz
          {/* Slides away to the right and the name is there, as if typed (a caret rides its edge). */}
          <span className="home-cover absolute inset-y-0 left-0 w-full border-l border-foreground bg-card" />
        </span>
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2 border-t border-border pt-1.5 text-muted-foreground">
        <span className="min-w-0 truncate">{SAMPLE_ITEMS[2].name}</span>
        <span className="shrink-0 tabular-nums text-foreground">{money(SAMPLE_ITEMS[2].amountMinor)}</span>
      </div>
    </div>
  );
}

/** The first revision gives way to the second, and the total changes with it. */
export function RevisionPicture() {
  const line = "col-start-1 row-start-1 flex items-baseline justify-between gap-2";
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="grid font-medium">
        <span className={cn(line, "home-rev-a text-muted-foreground")}>
          Rev 1 <span className="tabular-nums">{money(SAMPLE_TOTAL_MINOR)}</span>
        </span>
        <span className={cn(line, "home-rev-b")}>
          Rev 2 <span className="tabular-nums">{money(REVISED_TOTAL_MINOR)}</span>
        </span>
      </div>
      <span className="block h-1.5 w-2/3 rounded-full bg-muted" />
    </div>
  );
}

/** A draft that is deleted, slides into the bin, and is brought back. */
export function RecycleBinPicture() {
  return (
    <div data-theme="light" aria-hidden="true" className={FRAME}>
      <div className="flex items-center justify-between">
        <span className="home-bin-doc grid h-9 w-12 content-between rounded-sm border border-border bg-muted p-1 font-medium">
          Draft
          <span className="block h-0.5 w-2/3 rounded-full bg-border-strong" />
        </span>
        <Trash2Icon className="size-6 text-muted-foreground" />
      </div>
    </div>
  );
}
