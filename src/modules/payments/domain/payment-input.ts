import { PAYMENT_METHODS, type PaymentMethod } from "@/config/markets";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { examplePrice, parseMoneyInput } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";

// A payment as the "Record payment" form sends it (§B.5): the amount in the
// invoice's currency (never more than the balance; no overpayment in the MVP),
// any tax the customer withheld (PH: Form 2307, which also settles the
// balance), the date, the method and a free-text reference.

export const PAYMENT_LIMITS = { reference: 120, notes: 500 } as const;

export type RawPayment = {
  amount: string;
  withheld: string;
  paidOn: string;
  method: string;
  reference: string;
  notes: string;
};

export type PaymentInput = {
  amountMinor: number;
  withheldMinor: number;
  paidOn: CalendarDate;
  method: PaymentMethod;
  reference: string | null;
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
  const notes = raw.notes.trim();
  if (reference.length > PAYMENT_LIMITS.reference) errors.reference = tooLong(PAYMENT_LIMITS.reference);
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
      notes: notes || null,
    },
  };
}
