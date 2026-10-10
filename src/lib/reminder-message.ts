import { daysBetween, formatCalendarDate, type CalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";

type ReminderInput = {
  /** The customer's display name; only the first word is used, as a person would. */
  customerName: string | null;
  businessName: string;
  /** e.g. "Billing statement INV-000012". */
  documentName: string;
  balanceMinor: number;
  paidMinor: number;
  currency: string;
  locale: string;
  dueDate: CalendarDate;
  today: CalendarDate;
  url: string;
};

/**
 * A polite payment nudge to paste into Messenger, Viber or SMS. Deterministic
 * and plain on purpose: it only states what the document says (balance, due
 * date, link), so the person can send it as is or edit it first.
 */
export function reminderMessage(input: ReminderInput): string {
  const first = input.customerName?.trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : "Hello,";
  const amount = formatMoney(input.balanceMinor, input.currency, { locale: input.locale });
  const what = input.paidMinor > 0 ? `the remaining ${amount} on ${input.documentName}` : `${input.documentName} (${amount})`;
  const due = formatCalendarDate(input.dueDate, input.locale);
  const late = daysBetween(input.dueDate, input.today);
  const timing =
    late > 0
      ? `was due on ${due}, ${late === 1 ? "yesterday" : `${late} days ago`}`
      : late === 0
        ? "is due today"
        : `is due on ${due}`;
  return [
    `${hello} a friendly reminder that ${what} ${timing}.`,
    `You can see the details and how to pay here: ${input.url}`,
    `Thank you! — ${input.businessName}`,
  ].join("\n\n");
}
