import { PAYMENT_METHODS, type PaymentMethod } from "@/config/markets";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { examplePrice, parseMoneyInput } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";

// A payment as the "Record payment" form sends it (§B.5): the amount in the
// invoice's currency (never more than the balance; no overpayment in the MVP),
// any tax the customer withheld (PH: Form 2307, which also settles the
// balance), the date, the method and the proof of payment as the business
// types it: a reference number (transaction, receipt, cheque or deposit slip
// no.), the bank or wallet, who paid, the time, and for a cheque the date on
// it. Nothing here is checked against a bank: it's the business's own record.

export const PAYMENT_LIMITS = { reference: 120, institution: 80, payer: 120, notes: 500 } as const;

/** 24-hour time, "14:30". */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RawPayment = {
  amount: string;
  withheld: string;
  paidOn: string;
  method: string;
  reference: string;
  /** The bank or wallet it went through. */
  institution: string;
  /** Who paid, as shown on the transfer or cheque. */
  payer: string;
  /** The time paid, "14:30"; blank when unknown. */
  paidTime: string;
  /** A cheque's own date; ignored for other methods. */
  chequeDate: string;
  notes: string;
};

export type PaymentInput = {
  amountMinor: number;
  withheldMinor: number;
  paidOn: CalendarDate;
  method: PaymentMethod;
  reference: string | null;
  institution: string | null;
  payerName: string | null;
  paidTime: string | null;
  chequeDate: CalendarDate | null;
  notes: string | null;
};

export type PaymentInputResult = { ok: true; payment: PaymentInput } | { ok: false; errors: Record<string, string> };

export type PaymentInputOptions = {
  /** The invoice's currency; payments are always in it. */
  currency: string;
  /** The business's locale, for reading typed amounts. */
  locale: string;
  /** What's still owed: total minus active payments and withholding. */
  balanceMinor: number;
  /** Today in the business's time zone. */
  today: CalendarDate;
  /** Whether the market has withheld tax (MarketProfile.taxWithheld). */
  allowWithheld: boolean;
};

const isMethod = (value: string): value is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(value);

export function parsePaymentInput(raw: RawPayment, options: PaymentInputOptions): PaymentInputResult {
  const { currency, locale, balanceMinor, today } = options;
  const errors: Record<string, string> = {};
  const amountFormat = `Enter an amount like ${examplePrice(currency, locale)}.`;

  const readAmount = (text: string, field: string): number => {
    if (text.trim() === "") return 0;
    const value = parseMoneyInput(text, currency, locale);
    if (value === null) {
      errors[field] = amountFormat;
      return 0;
    }
    return value;
  };
  const amountMinor = readAmount(raw.amount, "amount");
  const withheldMinor = options.allowWithheld ? readAmount(raw.withheld, "withheld") : 0;

  if (!errors.amount && !errors.withheld) {
    if (amountMinor + withheldMinor <= 0) errors.amount = "Enter the amount received.";
    else if (amountMinor + withheldMinor > balanceMinor) {
      errors.amount = "That's more than the balance due. Record at most the balance.";
    }
  }

  if (!isCalendarDate(raw.paidOn)) errors.paidOn = "Enter a real date.";
  else if (compareDates(raw.paidOn, today) > 0) errors.paidOn = "The payment date can't be in the future.";

  if (!isMethod(raw.method)) errors.method = "Choose how it was paid.";

  const reference = raw.reference.trim();
  const institution = raw.institution.trim();
  const payer = raw.payer.trim();
  const paidTime = raw.paidTime.trim();
  const chequeDate = raw.method === "cheque" ? raw.chequeDate.trim() : "";
  const notes = raw.notes.trim();
  if (reference.length > PAYMENT_LIMITS.reference) errors.reference = tooLong(PAYMENT_LIMITS.reference);
  if (institution.length > PAYMENT_LIMITS.institution) errors.institution = tooLong(PAYMENT_LIMITS.institution);
  if (payer.length > PAYMENT_LIMITS.payer) errors.payer = tooLong(PAYMENT_LIMITS.payer);
  if (paidTime !== "" && !TIME.test(paidTime)) errors.paidTime = "Enter a time like 14:30.";
  // A cheque's date can be in the future: post-dated cheques are normal.
  if (chequeDate !== "" && !isCalendarDate(chequeDate)) errors.chequeDate = "Enter a real date.";
  if (notes.length > PAYMENT_LIMITS.notes) errors.notes = tooLong(PAYMENT_LIMITS.notes);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payment: {
      amountMinor,
      withheldMinor,
      paidOn: raw.paidOn,
      method: raw.method as PaymentMethod,
      reference: reference || null,
      institution: institution || null,
      payerName: payer || null,
      paidTime: paidTime || null,
      chequeDate: chequeDate || null,
      notes: notes || null,
    },
  };
}
