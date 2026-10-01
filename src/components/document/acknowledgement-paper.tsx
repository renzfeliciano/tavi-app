import { DocumentNumber } from "@/components/document-number";
import { Party } from "./document-paper";
import type { DocumentParty, DocumentView } from "./document-view";

// A payment acknowledgement as a sheet of paper (§B.5). In PH it's a
// supplementary document, not a BIR official receipt (D11, D13): it carries
// the bold notice and the market's disclaimer.

export type AcknowledgementView = {
  /** e.g. "Payment acknowledgement". */
  title: string;
  number: string;
  business: DocumentView["business"];
  customer: DocumentParty | null;
  /** Label/value pairs: date, method, reference, the invoice it's for, tax withheld. */
  details: { label: string; value: string }[];
  /** The amount received, formatted. */
  amount: string;
  /** e.g. "Voided: bounced transfer". */
  voided: string | null;
  notice: string | null;
  disclaimer: string | null;
};

export function AcknowledgementPaper({ view }: { view: AcknowledgementView }) {
  return (
    <article
      aria-label={`${view.title} ${view.number}`}
      className="rounded-lg border border-border bg-card p-6 text-foreground shadow-sm sm:p-8"
    >
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <Party label="From" party={view.business} />
        <div className="grid gap-1 sm:text-right">
          <p className="text-lg font-semibold">{view.title}</p>
          <p className="text-sm">
            No. <DocumentNumber number={view.number} />
          </p>
        </div>
      </header>

      {view.voided && (
        <p role="status" className="mt-6 rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm font-medium">
          {view.voided}
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {view.customer && <Party label="Received from" party={view.customer} />}
        <dl className="grid content-start gap-1 text-sm">
          {view.details.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 flex items-baseline justify-between border-t border-border pt-4">
        <p className="font-medium">Amount received</p>
        <p className="text-xl font-semibold tabular-nums">{view.amount}</p>
      </div>

      {view.notice && (
        <p className="mt-8 border-t border-border pt-4 text-center text-sm font-bold tracking-wide">{view.notice}</p>
      )}
      {view.disclaimer && <p className="mt-2 text-center text-xs text-muted-foreground">{view.disclaimer}</p>}
    </article>
  );
}
