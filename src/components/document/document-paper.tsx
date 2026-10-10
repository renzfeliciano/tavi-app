import Image from "next/image";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { DocumentNumber } from "@/components/document-number";
import { cn } from "@/lib/utils";
import type { DocumentParty, DocumentView } from "./document-view";

// A quote or invoice as the customer sees it: a sheet of paper (DESIGN.md
// "Carbon Copy"). Pure presentation from a DocumentView, so the editor
// preview, the saved document and the customer's page render identically.
// Notes and terms are plain text (§I: no HTML), kept with pre-wrap.

export function Party({ label, party }: { label: string; party: DocumentParty }) {
  return (
    <div className="grid content-start gap-0.5 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-semibold text-foreground">{party.name}</p>
      {party.subtitle && <p>{party.subtitle}</p>}
      {party.addressLines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
      {party.contactLines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
      {party.taxId && (
        <p className="text-muted-foreground">
          {party.taxId.label} <span className="font-mono">{party.taxId.value}</span>
        </p>
      )}
    </div>
  );
}

export function DocumentPaper({ view, className }: { view: DocumentView; className?: string }) {
  const { business } = view;
  // The figure the reader came for: the emphasised total, shown in the summary card and as the closing band.
  const due = view.totals.find((row) => row.emphasis) ?? null;
  const detailTotals = view.totals.filter((row) => row !== due);
  return (
    <div className="@container">
    <article
      aria-label={`${view.title}${view.number ? ` ${view.number}` : ""}`}
      className={cn(
        "overflow-hidden rounded-lg border border-border border-t-8 border-t-foreground bg-card p-6 text-foreground shadow-sm @xl:p-10",
        className,
      )}
    >
      <header className="flex flex-col-reverse gap-6 @xl:flex-row @xl:items-start @xl:justify-between">
        <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
          {business.logo && (
            <Image
              src={business.logo.src}
              alt={`${business.name} logo`}
              width={business.logo.width}
              height={business.logo.height}
              unoptimized
              className="mb-2 h-auto max-h-16 w-auto max-w-48 object-contain object-left"
            />
          )}
          <p className="text-base font-semibold">{business.name}</p>
          {business.subtitle && <p className="text-sm">{business.subtitle}</p>}
          <div className="text-sm text-muted-foreground">
            {[...business.addressLines, ...business.contactLines].map((line) => (
              <p key={line}>{line}</p>
            ))}
            {business.taxId && (
              <p>
                {business.taxId.label} <span className="font-mono">{business.taxId.value}</span>
              </p>
            )}
          </div>
        </div>
        <div className="grid min-w-0 gap-1 @xl:text-right">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{view.title}</h2>
          <p className="text-xl">
            <DocumentNumber number={view.number} />
            {view.revision > 1 && <span className="text-muted-foreground"> · Rev {view.revision}</span>}
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-6 @xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid min-w-0 content-between gap-4 [overflow-wrap:anywhere]">
          {view.customer ? (
            <Party label="Billed to" party={view.customer} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Choose a customer</p>
          )}
          {view.imprint && <StampImprint label={view.imprint} className="justify-self-start" />}
        </div>
        <div className="grid min-w-0 content-start gap-3 @xl:min-w-60 rounded-lg bg-surface-sunken p-4 text-sm">
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
            {view.dates.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right font-medium tabular-nums">{d.value}</dd>
              </div>
            ))}
          </dl>
          {due && (
            <div className="border-t border-border-strong pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{due.label}</p>
              <p className="text-xl font-semibold whitespace-nowrap tabular-nums @xl:text-2xl">{due.value}</p>
            </div>
          )}
        </div>
      </div>

      <table className="mt-10 w-full table-auto text-sm">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-y border-border-strong bg-surface-sunken text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="w-8 py-2.5 pr-1 pl-2 font-semibold">
              <span aria-hidden="true">#</span>
              <span className="sr-only">Line</span>
            </th>
            <th scope="col" className="py-2.5 pr-3 font-semibold">
              Description
            </th>
            <th scope="col" className="hidden py-2.5 pr-3 text-right font-semibold @xl:table-cell">
              Qty
            </th>
            <th scope="col" className="hidden py-2.5 pr-3 text-right font-semibold @xl:table-cell">
              Price
            </th>
            <th scope="col" className="py-2.5 pr-2 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {view.lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground italic">
                No items yet
              </td>
            </tr>
          ) : (
            view.lines.map((line, i) => (
              <tr key={i} className="border-b border-border align-top">
                <td className="py-3.5 pr-1 pl-2 text-muted-foreground tabular-nums" aria-hidden="true">
                  {i + 1}
                </td>
                <td className="py-3.5 pr-3">
                  <p className="font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">{line.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground @xl:hidden">
                    {line.quantity} {line.unit} × {line.unitPrice}
                  </p>
                  {(line.discount || line.tax) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[line.discount && `Discount ${line.discount}`, line.tax].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="hidden py-3.5 pr-3 text-right whitespace-nowrap tabular-nums @xl:table-cell">
                  {line.quantity} {line.unit}
                </td>
                <td className="hidden py-3.5 pr-3 text-right whitespace-nowrap tabular-nums @xl:table-cell">
                  {line.unitPrice}
                </td>
                <td className="py-3.5 pr-2 text-right font-medium whitespace-nowrap tabular-nums">{line.amount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-6 ml-auto grid w-full max-w-80 gap-1.5">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 px-2 text-sm">
          {detailTotals.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right whitespace-nowrap tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        {due && (
          <dl className="mt-1 flex items-baseline justify-between gap-6 rounded-md bg-foreground px-4 py-3 text-background">
            <dt className="text-sm font-semibold">{due.label}</dt>
            <dd className="text-lg font-semibold whitespace-nowrap tabular-nums">{due.value}</dd>
          </dl>
        )}
        {view.taxNotes.map((note) => (
          <p key={note} className="text-right text-xs text-muted-foreground">
            {note}
          </p>
        ))}
        {view.sales && (
          <section aria-label="Sales breakdown" className="w-full max-w-xs border-t border-border pt-2 text-sm">
            {view.sales.statement && <p className="text-right font-bold tracking-wide">{view.sales.statement}</p>}
            {view.sales.rows.length > 0 && (
              <dl className="grid gap-1">
                {view.sales.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right whitespace-nowrap tabular-nums">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
      </div>

      {view.qualifiedDiscount && (
        // RR 7-2024 Sec. 6 B.18: the buyer's ID number and their signature (D19).
        <section aria-label="Qualified discount" className="mt-8 grid gap-4 text-sm @xl:grid-cols-2 @xl:items-end">
          <div>
            <p className="font-medium">{view.qualifiedDiscount.holder}</p>
            <p className="text-muted-foreground">{view.qualifiedDiscount.idLine}</p>
          </div>
          <div className="pt-6">
            <div className="border-b border-border-strong" aria-hidden="true" />
            <p className="mt-1 text-center text-xs text-muted-foreground">{view.qualifiedDiscount.signature}</p>
          </div>
        </section>
      )}

      {view.paymentInstructions && (
        <section aria-label="How to pay" className="mt-10 rounded-lg border border-border border-l-4 border-l-stamp bg-surface-sunken p-4 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How to pay</p>
          <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{view.paymentInstructions}</p>
        </section>
      )}

      {(view.notes || view.terms) && (
        <footer className="mt-8 grid gap-6 border-t border-border pt-6 text-sm @xl:grid-cols-2">
          {view.notes && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
              <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{view.notes}</p>
            </div>
          )}
          {view.terms && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Terms</p>
              <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{view.terms}</p>
            </div>
          )}
        </footer>
      )}

      {view.notice && (
        <p className="mt-8 border-t border-border pt-4 text-center text-sm font-bold tracking-wide">{view.notice}</p>
      )}
      {view.registration && (
        <p className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">{view.registration}</p>
      )}
    </article>
    </div>
  );
}
