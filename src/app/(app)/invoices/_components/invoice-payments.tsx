"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, type PaymentDetailExamples, type PaymentDetailLabels, type PaymentMethod } from "@/config/markets";
import { MAX_ACK_RECIPIENTS, PAYMENT_LIMITS, parseAckRecipients, type ProofRow, type RawPayment } from "@/modules/payments/client";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatAmountForInput, formatMoney } from "@/shared/money";
import { eg } from "@/shared/text/example";
import { recordPaymentAction, voidPaymentAction } from "../../payments/actions";

export type InvoicePaymentRow = {
  id: string;
  receiptNumber: string;
  paidOn: string;
  method: PaymentMethod;
  /** The proof of payment as typed, already labelled. */
  details: ProofRow[];
  amountMinor: number;
  withheldMinor: number;
  voidReason: string | null;
};

type InvoicePaymentsProps = {
  invoiceId: string;
  /** e.g. "Billing statement INV-000001". */
  name: string;
  currency: string;
  locale: string;
  today: string;
  balanceMinor: number;
  payable: boolean;
  canRecord: boolean;
  canVoid: boolean;
  customerEmail: string | null;
  methodLabels: Record<PaymentMethod, string>;
  /** What each proof-of-payment field is called for each method. */
  detailLabels: Record<PaymentMethod, PaymentDetailLabels>;
  /** What those fields show while empty, for each method. */
  detailExamples: PaymentDetailExamples;
  chequeDateLabel: string;
  taxWithheld: { label: string; hint: string } | null;
  /** e.g. "Payment acknowledgement". */
  receiptTitle: string;
  payments: InvoicePaymentRow[];
};

const EMPTY_ERRORS: Record<string, string> = {};

/**
 * Payments on one invoice (§B.5): record one in a dialog (it changes what the
 * customer owes, so it's confirmed by its own button), and the history below
 * with each payment's acknowledgement and, for admins, Void with a reason.
 */
export function InvoicePayments(props: InvoicePaymentsProps) {
  const { currency, locale } = props;
  const router = useRouter();
  const money = (minor: number) => formatMoney(minor, currency, { locale });
  const blank = (): RawPayment => ({
    amount: formatAmountForInput(props.balanceMinor, currency, locale),
    withheld: "",
    paidOn: props.today,
    method: "bank_transfer",
    reference: "",
    institution: "",
    payer: "",
    paidTime: "",
    chequeDate: "",
    notes: "",
  });
  const [recording, setRecording] = useState(false);
  const [raw, setRaw] = useState<RawPayment>(blank);
  // One key per attempt: a retry of the same attempt sends it again, a new attempt gets a new one.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  // Who gets the acknowledgement: the customer (a checkbox) plus anyone else the business adds.
  const [acknowledge, setAcknowledge] = useState(Boolean(props.customerEmail));
  const [extraRecipients, setExtraRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [voiding, setVoiding] = useState<InvoicePaymentRow | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const id = useId();
  const method: PaymentMethod = PAYMENT_METHODS.includes(raw.method as PaymentMethod) ? (raw.method as PaymentMethod) : "other";
  const labels = props.detailLabels[method];
  const examples = props.detailExamples[method];

  const set = (patch: Partial<RawPayment>) => {
    setRaw((current) => ({ ...current, ...patch }));
    setAttemptKey(crypto.randomUUID()); // changed details are a new attempt
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const customerEmail = props.customerEmail?.toLowerCase() ?? null;
  const recipientsFor = (extras: string[]) => {
    const parsed = parseAckRecipients([...(acknowledge && customerEmail ? [customerEmail] : []), ...extras]);
    return parsed.ok ? parsed : null;
  };

  /** Adds the typed address to the list; returns the new list, or null when it isn't acceptable. */
  function addRecipient(): string[] | null {
    const typed = recipientDraft.trim();
    if (!typed) return extraRecipients;
    const checked = parseAckRecipients([typed]);
    if (!checked.ok) {
      setRecipientError(checked.error);
      return null;
    }
    const email = checked.emails[0] ?? typed;
    const next = extraRecipients.includes(email) || email === customerEmail ? extraRecipients : [...extraRecipients, email];
    const total = parseAckRecipients([...(acknowledge && customerEmail ? [customerEmail] : []), ...next]);
    if (!total.ok) {
      setRecipientError(total.error);
      return null;
    }
    setExtraRecipients(next);
    setRecipientDraft("");
    setRecipientError(null);
    return next;
  }

  async function submit() {
    const extras = addRecipient(); // an address typed but not yet added still counts
    if (!extras) return;
    const list = recipientsFor(extras);
    if (!list) return;
    setPending(true);
    const result = await recordPaymentAction(props.invoiceId, raw, list.emails, attemptKey);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) {
        const { recipients, ...rest } = result.errors;
        if (recipients) setRecipientError(recipients);
        setErrors(rest);
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
      return;
    }
    setAttemptKey(crypto.randomUUID());
    setRecording(false);
    toast.success(`Payment recorded on ${props.name}.`, {
      description: result.paidInFull
        ? `Paid in full. ${props.receiptTitle} ${result.receiptNumber}.`
        : `${props.receiptTitle} ${result.receiptNumber}.`,
    });
    router.refresh();
  }

  async function confirmVoid() {
    if (!voiding) return;
    setPending(true);
    const result = await voidPaymentAction(voiding.id, reason);
    setPending(false);
    if (!result.ok) {
      if ("errors" in result) setReasonError(result.errors.reason ?? null);
      else toast.error(result.error);
      return;
    }
    toast.success(`Payment ${voiding.receiptNumber} voided.`, { description: `${props.name} is updated.` });
    setVoiding(null);
    router.refresh();
  }

  const field = (key: keyof RawPayment) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: keyof RawPayment) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-8 max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="font-semibold">
            Payments
          </h2>
          <p className="text-sm text-muted-foreground">
            {props.balanceMinor > 0 ? (
              <>
                Balance due <MoneyAmount amountMinor={props.balanceMinor} currency={currency} locale={locale} className="font-medium text-foreground" />
              </>
            ) : (
              "Paid in full."
            )}
          </p>
        </div>
        {props.payable && props.canRecord && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              setRaw(blank());
              setErrors(EMPTY_ERRORS);
              setFormError(null);
              setAcknowledge(Boolean(props.customerEmail));
              setExtraRecipients([]);
              setRecipientDraft("");
              setRecipientError(null);
              setRecording(true);
            }}
          >
            <BanknoteIcon aria-hidden="true" />
            Record payment
          </Button>
        )}
      </div>

      {props.payments.length > 0 ? (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {props.payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/payments/${payment.id}`} className="font-medium underline-offset-4 hover:underline">
                  {props.receiptTitle} {payment.receiptNumber}
                </Link>
                <p className="text-muted-foreground">
                  {formatCalendarDate(payment.paidOn, locale)} · {props.methodLabels[payment.method]}
                  {payment.details.map((row) => ` · ${row.label}: ${row.value}`).join("")}
                  {payment.withheldMinor > 0 && props.taxWithheld
                    ? ` · ${props.taxWithheld.label} ${money(payment.withheldMinor)}`
                    : ""}
                </p>
                {payment.voidReason && <p className="text-muted-foreground">Voided: {payment.voidReason}</p>}
              </div>
              <div className="flex items-center gap-3">
                <MoneyAmount
                  amountMinor={payment.amountMinor}
                  currency={currency}
                  locale={locale}
                  className={payment.voidReason ? "text-muted-foreground line-through" : "font-medium"}
                />
                {props.canVoid && !payment.voidReason && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReason("");
                      setReasonError(null);
                      setVoiding(payment);
                    }}
                  >
                    Void
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>
      )}

      <Dialog open={recording} onOpenChange={(open) => !pending && setRecording(open)}>
        <DialogContent mascot="curious" className="sm:max-w-[min(42rem,calc(100%-2rem))]">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Record a payment</DialogTitle>
              <DialogDescription>
                On {props.name}. Balance due {money(props.balanceMinor)}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <FormAlert message={formError} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-amount`} className="text-sm font-medium">
                    Amount received ({currency})
                  </label>
                  <Input {...field("amount")} inputMode="decimal" placeholder="0.00" className="tabular-nums" value={raw.amount} onChange={(e) => set({ amount: e.target.value })} />
                  {fieldError("amount")}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-paidOn`} className="text-sm font-medium">
                    Date received
                  </label>
                  <Input {...field("paidOn")} type="date" max={props.today} value={raw.paidOn} onChange={(e) => set({ paidOn: e.target.value })} />
                  {fieldError("paidOn")}
                </div>
                {props.taxWithheld && (
                  <div className="grid gap-1.5 sm:col-span-2">
                    <label htmlFor={`${id}-withheld`} className="text-sm font-medium">
                      {props.taxWithheld.label} <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      {...field("withheld")}
                      aria-describedby={errors.withheld ? `${id}-withheld-error` : `${id}-withheld-hint`}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="tabular-nums"
                      value={raw.withheld}
                      onChange={(e) => set({ withheld: e.target.value })}
                    />
                    {fieldError("withheld") ?? (
                      <p id={`${id}-withheld-hint`} className="text-sm text-muted-foreground">
                        {props.taxWithheld.hint}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-method`} className="text-sm font-medium">
                    Method
                  </label>
                  <NativeSelect {...field("method")} value={raw.method} onChange={(e) => set({ method: e.target.value })}>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {props.methodLabels[method]}
                      </option>
                    ))}
                  </NativeSelect>
                  {fieldError("method")}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-reference`} className="text-sm font-medium">
                    {labels.reference} <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    {...field("reference")}
                    maxLength={PAYMENT_LIMITS.reference}
                    placeholder={eg(examples.reference)}
                    value={raw.reference}
                    onChange={(e) => set({ reference: e.target.value })}
                  />
                  {fieldError("reference")}
                </div>
                {labels.institution && (
                  <div className="grid gap-1.5">
                    <label htmlFor={`${id}-institution`} className="text-sm font-medium">
                      {labels.institution} <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      {...field("institution")}
                      maxLength={PAYMENT_LIMITS.institution}
                      placeholder={examples.institution ? eg(examples.institution) : undefined}
                      value={raw.institution}
                      onChange={(e) => set({ institution: e.target.value })}
                    />
                    {fieldError("institution")}
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-payer`} className="text-sm font-medium">
                    {labels.payer} <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input {...field("payer")} maxLength={PAYMENT_LIMITS.payer} placeholder={eg(examples.payer)} value={raw.payer} onChange={(e) => set({ payer: e.target.value })} />
                  {fieldError("payer")}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-paidTime`} className="text-sm font-medium">
                    Time paid <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input {...field("paidTime")} type="time" value={raw.paidTime} onChange={(e) => set({ paidTime: e.target.value })} />
                  {fieldError("paidTime")}
                </div>
                {raw.method === "cheque" && (
                  <div className="grid gap-1.5">
                    <label htmlFor={`${id}-chequeDate`} className="text-sm font-medium">
                      {props.chequeDateLabel} <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input {...field("chequeDate")} type="date" value={raw.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} />
                    {fieldError("chequeDate")}
                  </div>
                )}
                <div className="grid gap-1.5 sm:col-span-2">
                  <label htmlFor={`${id}-notes`} className="text-sm font-medium">
                    Notes <span className="font-normal text-muted-foreground">(optional, only your team sees them)</span>
                  </label>
                  <Textarea {...field("notes")} rows={2} maxLength={PAYMENT_LIMITS.notes} placeholder="e.g. Paid in person. Received by Ana." value={raw.notes} onChange={(e) => set({ notes: e.target.value })} />
                  {fieldError("notes")}
                </div>
              </div>
              <fieldset className="grid gap-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">Email a {props.receiptTitle.toLowerCase()}</legend>
                {props.customerEmail && (
                  <label htmlFor={`${id}-acknowledge`} className="flex items-start gap-2 text-sm">
                    <Checkbox id={`${id}-acknowledge`} checked={acknowledge} onCheckedChange={(checked) => setAcknowledge(checked === true)} className="mt-0.5" />
                    <span>
                      Email a {props.receiptTitle.toLowerCase()} to {props.customerEmail}
                    </span>
                  </label>
                )}
                {extraRecipients.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Also sending to">
                    {extraRecipients.map((email) => (
                      <li key={email} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-3 text-sm">
                        <span className="truncate">{email}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${email}`}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:size-8"
                          onClick={() => setExtraRecipients((current) => current.filter((x) => x !== email))}
                        >
                          <XIcon className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-recipient`} className="text-sm text-muted-foreground">
                    {props.customerEmail ? "Also send to another email" : "Send to an email"}{" "}
                    <span className="font-normal">(up to {MAX_ACK_RECIPIENTS} people)</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-recipient`}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="name@example.com"
                      value={recipientDraft}
                      aria-invalid={recipientError ? true : undefined}
                      aria-describedby={recipientError ? `${id}-recipient-error` : undefined}
                      onChange={(e) => {
                        setRecipientDraft(e.target.value);
                        setRecipientError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault(); // Enter adds the address; it doesn't submit the payment
                          addRecipient();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" disabled={!recipientDraft.trim()} onClick={() => void addRecipient()}>
                      Add
                    </Button>
                  </div>
                  {recipientError && (
                    <p id={`${id}-recipient-error`} role="alert" className="text-sm text-destructive">
                      {recipientError}
                    </p>
                  )}
                </div>
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Not now</DialogClose>
              <Button type="submit" pending={pending} pendingLabel="Recording…">
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={voiding !== null} onOpenChange={(open) => !open && !pending && setVoiding(null)}>
        <DialogContent mascot="concerned" tone="danger">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmVoid();
            }}
          >
            <DialogHeader>
              <DialogTitle>{voiding ? `Void payment ${voiding.receiptNumber}?` : ""}</DialogTitle>
              <DialogDescription>
                {`Use this when the payment didn't happen (e.g. a bounced transfer). It stays on the record, and ${props.name} goes back to owing it.`}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-void-reason`} className="text-sm font-medium">
                  Reason
                </label>
                <Textarea
                  id={`${id}-void-reason`}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. The transfer bounced."
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(null);
                  }}
                  aria-invalid={reasonError ? true : undefined}
                  aria-describedby={reasonError ? `${id}-void-reason-error` : undefined}
                />
                {reasonError && (
                  <p id={`${id}-void-reason-error`} className="text-sm text-destructive">
                    {reasonError}
                  </p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Keep it</DialogClose>
              <Button type="submit" variant="destructive" pending={pending} pendingLabel="Voiding…">
                Void payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
