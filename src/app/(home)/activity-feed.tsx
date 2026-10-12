import type { CSSProperties, ReactNode } from "react";
import { CheckCheckIcon, CheckIcon, CoinsIcon, SendIcon } from "lucide-react";
import { StatusBadge } from "@/components/status/status-badge";
import { formatMoney } from "@/shared/money";
import { SAMPLE_DOWNPAYMENT_MINOR, SAMPLE_NUMBER } from "./sample-quotation";

// The activity card that fills the left column of "And the rest of the job": the
// quotation approved, the billing statement sent, two payments in, and the
// statement paid, arriving one after another. Made-up figures from the sample
// quotation, in the words of the app's own activity list. It plays by itself in CSS
// (home.css: nothing but opacity and transform, and only for people who have not
// asked for less motion); without motion it shows all five at once. Always light,
// like the app's own screens, and decoration only: the words beside it say the
// same thing.

const INVOICE_NUMBER = SAMPLE_NUMBER.replace("QUO", "INV");
const money = (minor: number) => formatMoney(minor, "PHP");

type Tone = "success" | "info" | "warning" | "stamp";
const TONES: Record<Tone, string> = {
  success: "bg-success-subtle text-success-strong",
  info: "bg-info-subtle text-info-strong",
  warning: "bg-warning-subtle text-warning-strong",
  stamp: "bg-stamp-subtle text-stamp",
};

type Entry = { icon: ReactNode; tone: Tone; text: string; meta: string; end?: ReactNode };

export function ActivityFeed({ quote, invoice }: { quote: string; invoice: string }) {
  const amount = <span className="text-xs font-semibold tabular-nums">{money(SAMPLE_DOWNPAYMENT_MINOR)}</span>;
  const entries: Entry[] = [
    { icon: <CheckIcon className="size-3" strokeWidth={3} />, tone: "success", text: `${quote} ${SAMPLE_NUMBER} approved`, meta: "Juan Dela Cruz · from the link" },
    { icon: <SendIcon className="size-3" />, tone: "info", text: `${invoice} ${INVOICE_NUMBER} sent`, meta: "Emailed to Juan Dela Cruz" },
    { icon: <CoinsIcon className="size-3" />, tone: "warning", text: `Payment REC-000001 recorded on ${INVOICE_NUMBER}`, meta: "Downpayment · GCash", end: amount },
    { icon: <CoinsIcon className="size-3" />, tone: "warning", text: `Payment REC-000002 recorded on ${INVOICE_NUMBER}`, meta: "Final payment · Cash", end: amount },
    { icon: <CheckCheckIcon className="size-3" />, tone: "stamp", text: `${invoice} ${INVOICE_NUMBER} is paid`, meta: "Nothing left to collect", end: <StatusBadge kind="invoice" status="PAID" /> },
  ];

  return (
    <div data-theme="light" aria-hidden="true" className="w-full rounded-xl border border-border bg-card p-4 text-foreground shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <span className="font-heading text-sm font-semibold">Activity</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="home-live size-1.5 rounded-full bg-success" />
          Today
        </span>
      </div>
      <ol className="divide-y divide-border">
        {entries.map(({ icon, tone, text, meta, end }, index) => (
          <li key={text} className="home-feed-row flex min-h-14 items-center gap-3 py-2.5" style={{ "--i": index } as CSSProperties}>
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${TONES[tone]}`}>{icon}</span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-xs leading-snug font-medium">{text}</span>
              <span className="text-[0.65rem] text-muted-foreground">{meta}</span>
            </span>
            {end}
          </li>
        ))}
      </ol>
    </div>
  );
}
