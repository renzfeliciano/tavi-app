import { StampImprint } from "@/components/brand/stamp-imprint";
import { DocumentNumber } from "@/components/document-number";
import { MoneyAmount } from "@/components/money-amount";
import { StatusBadge } from "@/components/status/status-badge";
import { formatMoney } from "@/shared/money";

// A picture of the product's own paper: one sample quotation, with made-up
// people and figures, labelled as a sample. It is always light, like the real
// document sheet (DESIGN.md, themes), whatever theme the visitor uses. It
// shows only what the paper does today: a row discount, a row note, terms
// (where a downpayment is stated) and VAT included in the total.

export const SAMPLE_ITEMS = [
  { name: "Appliance repair", detail: "2 units × ₱1,200.00", amountMinor: 240_000 },
  { name: "Replacement parts", detail: "1 × ₱1,500.00", note: "Ordered once the downpayment is in", amountMinor: 150_000 },
  // ₱700.00 less the ₱100.00 discount.
  { name: "Check-up and labour", detail: "1 × ₱700.00", note: "Discount −₱100.00", amountMinor: 60_000 },
] as const;

export const SAMPLE_BUSINESS = "Renzo Feliciano Payod Repair Services";
export const SAMPLE_NUMBER = "QUO-000012";
export const SAMPLE_TOTAL_MINOR = SAMPLE_ITEMS.reduce((sum, item) => sum + item.amountMinor, 0);
export const SAMPLE_DOWNPAYMENT_MINOR = SAMPLE_TOTAL_MINOR / 2;

export function SampleQuotation({ documentName }: { documentName: string }) {
  return (
    <figure className="mx-auto w-full max-w-md lg:max-w-none">
      <div
        data-theme="light"
        className="relative rounded-xl border border-border bg-card p-5 text-foreground shadow-lg sm:p-7 pb-10 sm:pb-12"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-0.5">
            <p className="font-heading text-lg font-semibold">{SAMPLE_BUSINESS}</p>
            <p className="text-sm text-muted-foreground">General Trias City</p>
          </div>
          <div className="grid justify-items-end gap-0.5 text-right">
            <p className="text-sm font-medium">{documentName}</p>
            <DocumentNumber number={SAMPLE_NUMBER} className="text-sm" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Prepared for </span>
            <span className="font-medium">Juan Dela Cruz</span>
          </p>
          <StatusBadge kind="quote" status="APPROVED" />
        </div>

        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Items on the sample {documentName.toLowerCase()}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((item) => (
              <tr key={item.name} className="border-t border-border align-top">
                <td className="py-2.5 pr-3">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-muted-foreground tabular-nums">{item.detail}</span>
                  {"note" in item && <span className="block text-muted-foreground">{item.note}</span>}
                </td>
                <td className="py-2.5 text-right">
                  <MoneyAmount amountMinor={item.amountMinor} currency="PHP" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong">
              <th scope="row" className="pt-3 pr-3 text-left font-semibold">
                Total <span className="font-normal text-muted-foreground">(VAT included)</span>
              </th>
              <td className="pt-3 text-right text-base font-semibold">
                <MoneyAmount amountMinor={SAMPLE_TOTAL_MINOR} currency="PHP" />
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-5 border-t border-border pt-4 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Terms</p>
          <p className="mt-1">
            50% downpayment ({formatMoney(SAMPLE_DOWNPAYMENT_MINOR, "PHP")}) to start the job. Balance when it is done.
          </p>
        </div>

        <StampImprint label="Approved" animated className="absolute right-4 -bottom-4 bg-card sm:right-6" />
      </div>
      <figcaption className="mt-6 text-center text-xs text-muted-foreground">
        A sample {documentName.toLowerCase()}. Yours carries your own business&apos;s name and details.
      </figcaption>
    </figure>
  );
}
