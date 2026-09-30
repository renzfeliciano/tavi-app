import Image from "next/image";
import { DocumentNumber } from "@/components/document-number";
import { cn } from "@/lib/utils";
import type { DocumentParty, DocumentView } from "./document-view";

// A quote or invoice as the customer sees it: a sheet of paper (DESIGN.md
// "Carbon Copy"). Pure presentation from a DocumentView, so the editor
// preview, the saved document and the customer's page render identically.
// Notes and terms are plain text (§I: no HTML), kept with pre-wrap.

function Party({ label, party }: { label: string; party: DocumentParty }) {
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
  return (
    <article
      aria-label={`${view.title}${view.number ? ` ${view.number}` : ""}`}
      className={cn("rounded-lg border border-border bg-card p-6 text-foreground shadow-sm sm:p-8", className)}
    >
      <header className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
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
        <div className="grid gap-1 sm:text-right">
          <h2 className="text-xl font-semibold tracking-tight">{view.title}</h2>
          <p className="text-sm">
            <DocumentNumber number={view.number} />
            {view.revision > 1 && <span className="text-muted-foreground"> · Rev {view.revision}</span>}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-[1fr_auto]">
        {view.customer ? (
          <Party label="For" party={view.customer} />
        ) : (
          <p className="text-sm text-muted-foreground italic">Choose a customer</p>
        )}
        <dl className="grid content-start grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm sm:justify-end">
          {view.dates.map((d) => (
            <div key={d.label} className="contents">
              <dt className="text-muted-foreground">{d.label}</dt>
              <dd className="text-right tabular-nums">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <table className="mt-8 w-full text-sm">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b border-border-strong text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="py-2 pr-3 font-medium">
              Description
            </th>
            <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
              Qty
            </th>
            <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
              Price
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {view.lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-muted-foreground italic">
                No items yet
              </td>
            </tr>
          ) : (
            view.lines.map((line, i) => (
              <tr key={i} className="border-b border-border align-top">
                <td className="py-3 pr-3">
                  <p className="whitespace-pre-wrap">{line.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                    {line.quantity} {line.unit} × {line.unitPrice}
                  </p>
                  {(line.discount || line.tax) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[line.discount && `Discount ${line.discount}`, line.tax].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="hidden py-3 pr-3 text-right whitespace-nowrap tabular-nums sm:table-cell">
                  {line.quantity} {line.unit}
                </td>
                <td className="hidden py-3 pr-3 text-right whitespace-nowrap tabular-nums sm:table-cell">
                  {line.unitPrice}
                </td>
                <td className="py-3 text-right whitespace-nowrap tabular-nums">{line.amount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 ml-auto grid w-full max-w-72 gap-1.5">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
          {view.totals.map((row) => (
            <div key={row.label} className="contents">
              <dt className={cn("text-muted-foreground", row.emphasis && "border-t border-border-strong pt-2 font-semibold text-foreground")}>
                {row.label}
              </dt>
              <dd
                className={cn(
                  "text-right whitespace-nowrap tabular-nums",
                  row.emphasis && "border-t border-border-strong pt-2 text-base font-semibold",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {view.taxNotes.map((note) => (
          <p key={note} className="text-right text-xs text-muted-foreground">
            {note}
          </p>
        ))}
      </div>

      {view.paymentInstructions && (
        <section aria-label="How to pay" className="mt-8 rounded-lg border border-border bg-surface-sunken p-4 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How to pay</p>
          <p className="mt-1 whitespace-pre-wrap">{view.paymentInstructions}</p>
        </section>
      )}

      {(view.notes || view.terms) && (
        <footer className="mt-8 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2">
          {view.notes && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{view.notes}</p>
            </div>
          )}
          {view.terms && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Terms</p>
              <p className="mt-1 whitespace-pre-wrap">{view.terms}</p>
            </div>
          )}
        </footer>
      )}

      {view.notice && (
        <p className="mt-8 border-t border-border pt-4 text-center text-sm font-bold tracking-wide">{view.notice}</p>
      )}
    </article>
  );
}
