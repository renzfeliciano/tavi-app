import type { CertificateDetail, PendingPayment } from "@/modules/payments";
import { type Quarter, quarterBounds, quarterOf, type RawCertificate } from "@/modules/payments/client";
import { formatAmountForInput } from "@/shared/money";
import type { FormPayment } from "../_components/certificate-form";

// What the record and edit pages hand the 2307 form.

/** 200 → "2", 250 → "2.5": a rate as it is printed on the form. */
export const rateText = (bps: number) => String(bps / 100);

export const BLANK_LINE = { atcCode: "", description: "", rate: "", month1: "", month2: "", month3: "", taxWithheld: "" };

/** The payments a form can offer: those in the business's currency (a certificate has one currency). */
export function formPayments(pending: readonly PendingPayment[], currency: string): FormPayment[] {
  return pending
    .filter((p) => p.currency === currency)
    .map(({ paymentId, receiptNumber, paidOn, invoiceNumber, withheldMinor }) => ({ paymentId, receiptNumber, paidOn, invoiceNumber, withheldMinor }));
}

/**
 * The quarter a new certificate starts on: the oldest payment still waiting, or else the quarter just finished
 * (a customer sends the 2307 after the quarter ends).
 */
export function startingQuarter(payments: readonly FormPayment[], today: string): { year: number; quarter: Quarter } {
  const oldest = payments[0];
  if (oldest) return quarterOf(oldest.paidOn);
  const now = quarterOf(today);
  return now.quarter === 1 ? { year: now.year - 1, quarter: 4 } : { year: now.year, quarter: (now.quarter - 1) as Quarter };
}

/** Every waiting payment dated in the quarter: a new certificate covers them unless the person unticks some. */
export function paymentsIn(payments: readonly FormPayment[], year: number, quarter: Quarter): FormPayment[] {
  const { from, to } = quarterBounds(year, quarter);
  return payments.filter((p) => p.paidOn >= from && p.paidOn <= to);
}

export function newCertificate(
  customer: { id: string; displayName: string; company: string | null; taxId: string | null },
  payments: readonly FormPayment[],
  today: string,
): RawCertificate {
  const { year, quarter } = startingQuarter(payments, today);
  return {
    customerId: customer.id,
    payorTin: customer.taxId ?? "",
    payorName: customer.company ?? customer.displayName,
    payorAddress: "",
    year: String(year),
    quarter: String(quarter),
    receivedOn: today,
    notes: "",
    lines: [{ ...BLANK_LINE }],
    paymentIds: paymentsIn(payments, year, quarter).map((p) => p.paymentId),
  };
}

/** A saved certificate as the form types it, so editing starts from exactly what was recorded. */
export function editedCertificate(
  detail: Pick<CertificateDetail, "customerId" | "payorTin" | "payorName" | "payorAddress" | "periodFrom" | "receivedOn" | "notes"> & {
    lines: readonly { atcCode: string; description: string | null; rateBps: number; monthMinor: readonly [number, number, number]; taxWithheldMinor: number }[];
    payments: readonly { paymentId: string }[];
  },
  currency: string,
  locale: string,
): RawCertificate {
  const amount = (minor: number) => (minor === 0 ? "" : formatAmountForInput(minor, currency, locale));
  const { year, quarter } = quarterOf(detail.periodFrom);
  return {
    customerId: detail.customerId,
    payorTin: detail.payorTin,
    payorName: detail.payorName,
    payorAddress: detail.payorAddress ?? "",
    year: String(year),
    quarter: String(quarter),
    receivedOn: detail.receivedOn,
    notes: detail.notes ?? "",
    lines: detail.lines.map((line) => ({
      atcCode: line.atcCode,
      description: line.description ?? "",
      rate: rateText(line.rateBps),
      month1: amount(line.monthMinor[0]),
      month2: amount(line.monthMinor[1]),
      month3: amount(line.monthMinor[2]),
      taxWithheld: formatAmountForInput(line.taxWithheldMinor, currency, locale),
    })),
    paymentIds: detail.payments.map((p) => p.paymentId),
  };
}
