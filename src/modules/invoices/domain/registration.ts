import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type CalendarDate, compareDates, formatCalendarDate, isCalendarDate } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";

// Invoice mode (D13, D14, proposal §B.7, 1.12): a business that has
// registered its invoicing system with the tax authority (PH: the RDO's
// Acknowledgement Certificate / Permit to Use) enters it here. From then on
// its bills are titled invoices, numbered only inside the approved series,
// printed with the registration at the foot (RR 7-2024 Sec. 6 B.21) and
// locked once issued (RMC 98-2026 Sec. IV.8, D14).

export const INVOICE_REGISTRATION_LIMITS = { number: 40, serialDigits: 10 } as const;

export type InvoiceRegistration = {
  number: string;
  issuedOn: CalendarDate;
  seriesStart: number;
  seriesEnd: number;
  title: string;
};

/** What an issued registered invoice keeps: the registration as printed, and its serial. */
export type InvoiceRegistrationSnapshot = InvoiceRegistration & { serial: number };

export type InvoiceRegistrationResult =
  | { ok: true; registration: InvoiceRegistration }
  | { ok: false; errors: Record<string, string> };

const rawSchema = z.object({
  number: z.string(),
  issuedOn: z.string(),
  seriesStart: z.string(),
  seriesEnd: z.string(),
  title: z.string(),
});

const SERIAL = new RegExp(`^\\d{1,${INVOICE_REGISTRATION_LIMITS.serialDigits}}$`);

export function parseInvoiceRegistration(
  input: unknown,
  { market, today, lastIssuedSerial }: { market: MarketProfile; today: CalendarDate; lastIssuedSerial: number | null },
): InvoiceRegistrationResult {
  const config = market.invoiceRegistration;
  if (!config) return { ok: false, errors: { number: "Invoice registration isn't available in your country yet." } };
  const shape = rawSchema.safeParse(input);
  if (!shape.success) return { ok: false, errors: { number: "Something in the form didn't come through. Reload and try again." } };
  const raw = shape.data;
  const errors: Record<string, string> = {};

  const number = raw.number.trim();
  if (number === "") errors.number = `Enter the ${config.numberLabel}.`;
  else if (number.length > INVOICE_REGISTRATION_LIMITS.number) errors.number = tooLong(INVOICE_REGISTRATION_LIMITS.number);

  const issuedOn = raw.issuedOn.trim();
  if (!isCalendarDate(issuedOn)) errors.issuedOn = "Enter a real date.";
  else if (compareDates(issuedOn, today) > 0) errors.issuedOn = "The date issued can't be in the future.";

  const serial = (text: string, field: "seriesStart" | "seriesEnd", example: string): number | null => {
    const value = text.trim();
    if (/^\d+$/.test(value) && !SERIAL.test(value)) {
      errors[field] = `Use up to ${INVOICE_REGISTRATION_LIMITS.serialDigits} digits.`;
      return null;
    }
    if (!SERIAL.test(value)) {
      errors[field] = `Enter a whole number, e.g. ${example}.`;
      return null;
    }
    return Number(value);
  };
  const seriesStart = serial(raw.seriesStart, "seriesStart", "1");
  const seriesEnd = serial(raw.seriesEnd, "seriesEnd", "5000");
  if (seriesStart !== null && seriesStart < 1) errors.seriesStart = "Serial numbers start at 1 or higher.";
  if (seriesStart !== null && seriesEnd !== null && !errors.seriesStart && seriesEnd < seriesStart) {
    errors.seriesEnd = "The last serial number can't be lower than the first.";
  }
  // Serials are never reused or skipped back over (§B.6).
  if (seriesEnd !== null && !errors.seriesEnd && lastIssuedSerial !== null && seriesEnd < lastIssuedSerial) {
    errors.seriesEnd = `You've already issued serial ${lastIssuedSerial}. The series must end at ${lastIssuedSerial} or later.`;
  }

  const title = raw.title.trim();
  if (!config.titles.includes(title)) errors.title = "Choose a title from the list.";

  if (Object.keys(errors).length > 0 || seriesStart === null || seriesEnd === null) return { ok: false, errors };
  return { ok: true, registration: { number, issuedOn, seriesStart, seriesEnd, title } };
}

/** A serial as printed: zero-padded to the width of the series' last number ("0007" in 1–5000). */
export function formatSerial(serial: number, seriesEnd: number): string {
  return String(serial).padStart(String(seriesEnd).length, "0");
}

/** The registration line at the foot of a registered invoice (RR 7-2024 Sec. 6 B.21). */
export function registrationFooter(
  snapshot: InvoiceRegistrationSnapshot,
  market: Pick<MarketProfile, "invoiceRegistration">,
  locale: string,
): string {
  const template = market.invoiceRegistration?.footer ?? "{number} · {date} · {start}–{end}";
  return template
    .replace("{number}", snapshot.number)
    .replace("{date}", formatCalendarDate(snapshot.issuedOn, locale))
    .replace("{start}", formatSerial(snapshot.seriesStart, snapshot.seriesEnd))
    .replace("{end}", formatSerial(snapshot.seriesEnd, snapshot.seriesEnd));
}

/** What an issued bill is called: its registered title, or the market's supplementary-document name. */
export function invoiceTitle(
  invoice: { registration: Pick<InvoiceRegistrationSnapshot, "title"> | null },
  market: Pick<MarketProfile, "documents">,
): string {
  return invoice.registration?.title ?? market.documents.invoice.singular;
}
