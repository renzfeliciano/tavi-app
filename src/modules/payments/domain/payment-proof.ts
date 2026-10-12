import type { CalendarDate } from "@/shared/dates/calendar";
import type { MarketProfile, PaymentMethod } from "@/config/markets";

// The proof of payment as the business typed it, ready to print: one labelled
// row per detail that was entered. The labels depend on how it was paid (a
// cheque has a cheque no., a deposit has a slip no.) and come from the market
// profile. Used by the acknowledgement paper, PDF and email, and the lists.

export type PaymentProof = {
  method: PaymentMethod;
  reference: string | null;
  institution: string | null;
  payerName: string | null;
  paidTime: string | null;
  chequeDate: CalendarDate | null;
};

export type ProofRow = { label: string; value: string };

/** "14:30" as "2:30 PM". */
function clock(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour < 12 ? "AM" : "PM"}`;
}

export function paymentProofRows(
  payment: PaymentProof,
  market: Pick<MarketProfile, "paymentDetailLabels" | "chequeDateLabel">,
  formatDate: (date: CalendarDate) => string,
): ProofRow[] {
  const labels = market.paymentDetailLabels[payment.method];
  const rows: ProofRow[] = [];
  if (payment.reference) rows.push({ label: labels.reference, value: payment.reference });
  if (payment.institution && labels.institution) rows.push({ label: labels.institution, value: payment.institution });
  if (payment.payerName) rows.push({ label: labels.payer, value: payment.payerName });
  if (payment.paidTime) rows.push({ label: "Time paid", value: clock(payment.paidTime) });
  if (payment.chequeDate && payment.method === "cheque") {
    rows.push({ label: market.chequeDateLabel, value: formatDate(payment.chequeDate) });
  }
  return rows;
}
