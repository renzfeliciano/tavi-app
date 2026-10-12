import { z } from "zod";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { examplePrice, parseMoneyInput } from "@/shared/money";
import { parseDecimalInput } from "@/shared/numbers/decimal-input";
import { tooLong } from "@/shared/validation/messages";

// Withholding-tax certificates (PH: BIR Form 2307). A customer withholds tax
// when they pay and sends the business a certificate later. These are the
// pure rules: the calendar quarter, the tax the form suggests, a payment's
// status, the check against the payments it covers, and the form's input
// (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md).

export type Quarter = 1 | 2 | 3 | 4;

export const WITHHOLDING_LIMITS = { tin: 20, name: 120, address: 200, notes: 500, atc: 10, description: 120, maxRows: 5 } as const;

/** Why a payment can't go on a certificate. One place, so the wording is easy to change. */
export const LINK_MESSAGES = {
  notFound: "One of those payments can't be found.",
  otherCustomer: "That payment belongs to another customer.",
  voided: "That payment was voided.",
  noWithheld: "That payment has no tax withheld.",
  currency: "That payment is in a different currency.",
  outsidePeriod: "That payment is dated outside the period on the certificate.",
  alreadyLinked: "That payment is already on another 2307.",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** The first and last day of a calendar quarter. */
export function quarterBounds(year: number, quarter: Quarter): { from: CalendarDate; to: CalendarDate } {
  const startMonth = (quarter - 1) * 3 + 1;
  const lastDay = new Date(Date.UTC(year, startMonth + 2, 0)).getUTCDate();
  return { from: `${year}-${pad(startMonth)}-01`, to: `${year}-${pad(startMonth + 2)}-${pad(lastDay)}` };
}

/** The calendar year and quarter a date falls in. */
export function quarterOf(date: CalendarDate): { year: number; quarter: Quarter } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return { year, quarter: (Math.floor((month - 1) / 3) + 1) as Quarter };
}

/** The names of a quarter's three months, in the locale: the form's 1st, 2nd and 3rd month columns. */
export function monthNamesOfQuarter(quarter: Quarter, locale: string): [string, string, string] {
  const format = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const name = (offset: number) => format.format(new Date(Date.UTC(2000, (quarter - 1) * 3 + offset, 1)));
  return [name(0), name(1), name(2)];
}

/** What the form suggests for the tax withheld: rate × income payments, half up. Only a default; the person can type what is printed. */
export function defaultTaxWithheld(totalMinor: number, rateBps: number): number {
  // BigInt: the largest amounts the app accepts times 10,000 pass what a float holds exactly.
  return Number((BigInt(totalMinor) * BigInt(rateBps) + 5000n) / 10000n);
}

export type WithholdingStatus = "none" | "pending" | "received";

/** A payment's 2307 status: nothing withheld, withheld and waiting for the certificate, or on a certificate. */
export function withholdingStatus(withheldMinor: number, linked: boolean): WithholdingStatus {
  if (withheldMinor <= 0) return "none";
  return linked ? "received" : "pending";
}

/** The certificate's total against the payments linked to it. Informational: a certificate can cover payments made outside Tavi. */
export function reconcile(certificateTaxMinor: number, linkedTaxMinor: number): { matches: boolean; differenceMinor: number } {
  const differenceMinor = certificateTaxMinor - linkedTaxMinor;
  return { matches: differenceMinor === 0, differenceMinor };
}

export type RawCertificateLine = {
  atcCode: string;
  description: string;
  /** A percent as typed: "2" or "2.5". */
  rate: string;
  month1: string;
  month2: string;
  month3: string;
  taxWithheld: string;
};

/** A certificate as the "Record 2307" form sends it. */
export type RawCertificate = {
  customerId: string;
  payorTin: string;
  payorName: string;
  payorAddress: string;
  year: string;
  quarter: string;
  receivedOn: string;
  notes: string;
  lines: RawCertificateLine[];
  paymentIds: string[];
};

export type CertificateLineInput = {
  position: number;
  atcCode: string;
  description: string | null;
  rateBps: number;
  monthMinor: [number, number, number];
  totalMinor: number;
  taxWithheldMinor: number;
};

export type CertificateInput = {
  customerId: string;
  payorTin: string;
  payorName: string;
  payorAddress: string | null;
  periodFrom: CalendarDate;
  periodTo: CalendarDate;
  receivedOn: CalendarDate;
  notes: string | null;
  lines: CertificateLineInput[];
  paymentIds: string[];
};

export type CertificateInputResult = { ok: true; value: CertificateInput } | { ok: false; errors: Record<string, string> };

export type CertificateInputOptions = { currency: string; locale: string; today: CalendarDate };

const ATC = /^[A-Z0-9]{1,10}$/;
const TIN_CHARACTERS = /^[\d\s-]+$/;
const MIN_TIN_DIGITS = 9;
const MAX_RATE_BPS = 10_000;

export function parseCertificateInput(raw: RawCertificate, options: CertificateInputOptions): CertificateInputResult {
  const { currency, locale, today } = options;
  const errors: Record<string, string> = {};
  const amountFormat = `Enter an amount like ${examplePrice(currency, locale)}.`;

  if (!z.uuid().safeParse(raw.customerId).success) errors.customerId = "Choose who sent this 2307.";

  const payorTin = raw.payorTin.trim().replace(/\s+/g, " ");
  const tinDigits = payorTin.replace(/\D/g, "");
  if (!TIN_CHARACTERS.test(payorTin) || tinDigits.length < MIN_TIN_DIGITS) {
    errors.payorTin = "Enter the payor's TIN as written on the form: at least 9 digits.";
  } else if (payorTin.length > WITHHOLDING_LIMITS.tin) {
    errors.payorTin = tooLong(WITHHOLDING_LIMITS.tin);
  }

  const payorName = raw.payorName.trim();
  if (!payorName) errors.payorName = "Enter the payor's name as written on the form.";
  else if (payorName.length > WITHHOLDING_LIMITS.name) errors.payorName = tooLong(WITHHOLDING_LIMITS.name);

  const payorAddress = raw.payorAddress.trim();
  if (payorAddress.length > WITHHOLDING_LIMITS.address) errors.payorAddress = tooLong(WITHHOLDING_LIMITS.address);

  const notes = raw.notes.trim();
  if (notes.length > WITHHOLDING_LIMITS.notes) errors.notes = tooLong(WITHHOLDING_LIMITS.notes);

  const year = /^\d{4}$/.test(raw.year) ? Number(raw.year) : NaN;
  const quarter = Number(raw.quarter);
  const quarterOk = year >= 2000 && year <= 2100 && [1, 2, 3, 4].includes(quarter) && /^[1-4]$/.test(raw.quarter);
  if (!quarterOk) errors.quarter = "Choose the year and quarter on the certificate.";

  if (!isCalendarDate(raw.receivedOn)) errors.receivedOn = "Enter a real date.";
  else if (compareDates(raw.receivedOn, today) > 0) errors.receivedOn = "The date received can't be in the future.";

  const readAmount = (text: string, field: string): number => {
    if (text.trim() === "") return 0;
    const value = parseMoneyInput(text, currency, locale);
    if (value === null) {
      errors[field] = amountFormat;
      return 0;
    }
    return value;
  };

  const lines: CertificateLineInput[] = [];
  if (raw.lines.length === 0) errors.lines = "Add at least one row from the certificate.";
  else if (raw.lines.length > WITHHOLDING_LIMITS.maxRows) errors.lines = `Use at most ${WITHHOLDING_LIMITS.maxRows} rows.`;
  else {
    raw.lines.forEach((line, index) => {
      const key = (field: string) => `lines.${index}.${field}`;

      const atcCode = line.atcCode.trim().toUpperCase();
      if (!ATC.test(atcCode)) errors[key("atcCode")] = "Enter the ATC code: letters and numbers only, like WI160.";

      const description = line.description.trim();
      if (description.length > WITHHOLDING_LIMITS.description) errors[key("description")] = tooLong(WITHHOLDING_LIMITS.description);

      const rateBps = parseDecimalInput(line.rate, { locale, scale: 2, maxWholeDigits: 3 });
      if (rateBps === null || rateBps < 1 || rateBps > MAX_RATE_BPS) {
        errors[key("rate")] = "Enter the rate as a percent from 0.01 to 100, like 2.";
      }

      const monthMinor: [number, number, number] = [
        readAmount(line.month1, key("month1")),
        readAmount(line.month2, key("month2")),
        readAmount(line.month3, key("month3")),
      ];
      const monthsOk = !errors[key("month1")] && !errors[key("month2")] && !errors[key("month3")];
      const totalMinor = monthMinor[0] + monthMinor[1] + monthMinor[2];
      if (monthsOk && totalMinor <= 0) errors[key("total")] = "Enter the income payments for at least one month.";

      let taxWithheldMinor = 0;
      if (line.taxWithheld.trim() === "") errors[key("taxWithheld")] = "Enter the tax withheld, as printed on the form.";
      else {
        taxWithheldMinor = readAmount(line.taxWithheld, key("taxWithheld"));
        if (!errors[key("taxWithheld")]) {
          if (taxWithheldMinor <= 0) errors[key("taxWithheld")] = "Enter the tax withheld, as printed on the form.";
          else if (monthsOk && totalMinor > 0 && taxWithheldMinor > totalMinor) {
            errors[key("taxWithheld")] = "The tax withheld can't be more than the income payments.";
          }
        }
      }

      lines.push({
        position: index + 1,
        atcCode,
        description: description || null,
        rateBps: rateBps ?? 0,
        monthMinor,
        totalMinor,
        taxWithheldMinor,
      });
    });
  }

  const paymentIds = [...new Set(raw.paymentIds)];
  if (!paymentIds.every((id) => z.uuid().safeParse(id).success)) errors.paymentIds = "Choose the payments from the list.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const period = quarterBounds(year, quarter as Quarter);
  return {
    ok: true,
    value: {
      customerId: raw.customerId,
      payorTin,
      payorName,
      payorAddress: payorAddress || null,
      periodFrom: period.from,
      periodTo: period.to,
      receivedOn: raw.receivedOn,
      notes: notes || null,
      lines,
      paymentIds,
    },
  };
}

