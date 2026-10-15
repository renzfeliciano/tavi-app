import { PAYMENT_METHODS, type PaymentMethod, RECEIPT_KINDS, type ReceiptKind } from "@/config/markets";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { examplePrice, parseMoneyInput } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { PAYMENT_LIMITS } from "./payment-input";

// A receipt for money that is not an invoice payment (a reimbursement, a deposit, an advance): as the "New receipt"
// form sends it. Docs: docs/superpowers/specs/2026-10-15-receipts-design.md. Nothing here is checked against a bank.

export { RECEIPT_KINDS, type ReceiptKind };

export const RECEIPT_LIMITS = { payer: 200, purpose: 120, notes: 2000, reason: 500 } as const;

/** 24-hour time, "14:30". */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RawReceipt = {
  kind: string;
  /** Who paid, as typed; blank to use the chosen customer's name. */
  payer: string;
  amount: string;
  receivedOn: string;
  method: string;
  reference: string;
  /** The bank or wallet it went through. */
  institution: string;
  /** The time received, "14:30"; blank when unknown. */
  paidTime: string;
  /** A cheque's own date; ignored for other methods. */
  chequeDate: string;
  /** What the money is for. */
  purpose: string;
  notes: string;
};

export type ReceiptInput = {
  kind: ReceiptKind;
  payerName: string;
  amountMinor: number;
  receivedOn: CalendarDate;
  method: PaymentMethod;
  reference: string | null;
  institution: string | null;
  paidTime: string | null;
  chequeDate: CalendarDate | null;
  purpose: string;
  notes: string | null;
};

export type ReceiptInputResult = { ok: true; receipt: ReceiptInput } | { ok: false; errors: Record<string, string> };

export type ReceiptInputOptions = {
  /** The business's currency; receipts are always in it. */
  currency: string;
  /** The business's locale, for reading the typed amount. */
  locale: string;
  /** Today in the business's time zone. */
  today: CalendarDate;
  /** The chosen customer's name, used when no payer is typed. */
  defaultPayer?: string | null;
};

const isKind = (value: string): value is ReceiptKind => (RECEIPT_KINDS as readonly string[]).includes(value);
const isMethod = (value: string): value is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(value);

export function parseReceiptInput(raw: RawReceipt, { currency, locale, today, defaultPayer = null }: ReceiptInputOptions): ReceiptInputResult {
  const errors: Record<string, string> = {};

  if (!isKind(raw.kind)) errors.kind = "Choose the kind of receipt.";

  let amountMinor = 0;
  if (raw.amount.trim() === "") errors.amount = "Enter the amount received.";
  else {
    const value = parseMoneyInput(raw.amount, currency, locale);
    if (value === null) errors.amount = `Enter an amount like ${examplePrice(currency, locale)}.`;
    else if (value <= 0) errors.amount = "Enter the amount received.";
    else amountMinor = value;
  }

  if (!isCalendarDate(raw.receivedOn)) errors.receivedOn = "Enter a real date.";
  else if (compareDates(raw.receivedOn, today) > 0) errors.receivedOn = "The date received can't be in the future.";

  if (!isMethod(raw.method)) errors.method = "Choose how it was paid.";

  const payer = raw.payer.trim() || (defaultPayer ?? "").trim();
  const purpose = raw.purpose.trim();
  const reference = raw.reference.trim();
  const institution = raw.institution.trim();
  const paidTime = raw.paidTime.trim();
  const chequeDate = raw.method === "cheque" ? raw.chequeDate.trim() : "";
  const notes = raw.notes.trim();
  if (!payer) errors.payer = "Enter who paid.";
  else if (payer.length > RECEIPT_LIMITS.payer) errors.payer = tooLong(RECEIPT_LIMITS.payer);
  if (!purpose) errors.purpose = "Say what the money is for.";
  else if (purpose.length > RECEIPT_LIMITS.purpose) errors.purpose = tooLong(RECEIPT_LIMITS.purpose);
  if (reference.length > PAYMENT_LIMITS.reference) errors.reference = tooLong(PAYMENT_LIMITS.reference);
  if (institution.length > PAYMENT_LIMITS.institution) errors.institution = tooLong(PAYMENT_LIMITS.institution);
  if (paidTime !== "" && !TIME.test(paidTime)) errors.paidTime = "Enter a time like 14:30.";
  // A cheque's date can be in the future: post-dated cheques are normal.
  if (chequeDate !== "" && !isCalendarDate(chequeDate)) errors.chequeDate = "Enter a real date.";
  if (notes.length > RECEIPT_LIMITS.notes) errors.notes = tooLong(RECEIPT_LIMITS.notes);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    receipt: {
      kind: raw.kind as ReceiptKind,
      payerName: payer,
      amountMinor,
      receivedOn: raw.receivedOn,
      method: raw.method as PaymentMethod,
      reference: reference || null,
      institution: institution || null,
      paidTime: paidTime || null,
      chequeDate: chequeDate || null,
      purpose,
      notes: notes || null,
    },
  };
}
