"use client";

import { useId, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/async-combobox";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, type PaymentDetailExamples, type PaymentDetailLabels, type PaymentMethod } from "@/config/markets";
import { PAYMENT_LIMITS, RECEIPT_LIMITS, type RawReceipt, type ReceiptKind } from "@/modules/payments/client";
import { eg } from "@/shared/text/example";
import { issueReceiptAction, type ReceiptCustomerChoice, searchReceiptCustomersAction } from "../actions";
import { RecipientsField, useRecipients } from "./recipients-field";

export type ReceiptFormProps = {
  /** The titles a receipt can carry, from the market. */
  kinds: { value: ReceiptKind; title: string }[];
  currency: string;
  locale: string;
  today: string;
  methodLabels: Record<PaymentMethod, string>;
  detailLabels: Record<PaymentMethod, PaymentDetailLabels>;
  detailExamples: PaymentDetailExamples;
  chequeDateLabel: string;
  /** What "Received for" shows while empty. */
  purposeExample: string;
  /** What "Payer's name" shows while empty. */
  payerExample: string;
};

type Form = Omit<RawReceipt, "kind"> & { kind: string; customerId: string };
type Payer = "customer" | "someone";

/**
 * Makes a numbered receipt for money that isn't an invoice payment. It's issued at once and can't be edited (a
 * mistake is voided), so the one button says what it does.
 */
export function ReceiptForm(props: ReceiptFormProps) {
  const router = useRouter();
  const id = useId();
  const [form, setForm] = useState<Form>({
    kind: props.kinds[0]?.value ?? "collection",
    customerId: "",
    payer: "",
    amount: "",
    receivedOn: props.today,
    method: "cash",
    reference: "",
    institution: "",
    paidTime: "",
    chequeDate: "",
    purpose: "",
    notes: "",
  });
  const [payerMode, setPayerMode] = useState<Payer>("customer");
  const [customer, setCustomer] = useState<ReceiptCustomerChoice | null>(null);
  const [sendToCustomer, setSendToCustomer] = useState(true);
  // One key per attempt: a retry sends it again, changed details are a new attempt.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const customerEmail = payerMode === "customer" ? (customer?.email?.toLowerCase() ?? null) : null;
  const recipients = useRecipients(customerEmail ? [customerEmail] : []);
  const method: PaymentMethod = PAYMENT_METHODS.includes(form.method as PaymentMethod) ? (form.method as PaymentMethod) : "other";
  const labels = props.detailLabels[method];
  const examples = props.detailExamples[method];

  const set = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setAttemptKey(crypto.randomUUID());
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      if ("customerId" in patch) delete next.payer;
      return next;
    });
  };

  const field = (key: string) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  function chooseCustomer(next: ReceiptCustomerChoice | null) {
    setCustomer(next);
    setSendToCustomer(true);
    set({ customerId: next?.id ?? "", payer: next?.displayName ?? "" });
  }

  function choosePayer(next: Payer) {
    setPayerMode(next);
    if (next === "someone") {
      setCustomer(null);
      set({ customerId: "", payer: "" });
    }
  }

  async function submit() {
    const extras = recipients.add(); // an address typed but not yet added still counts
    if (!extras) return;
    const emails = [...(customerEmail && sendToCustomer ? [customerEmail] : []), ...extras];
    setPending(true);
    setFormError(null);
    const result = await issueReceiptAction({ raw: form, recipients: emails, idempotencyKey: attemptKey });
    if (!result.ok) {
      setPending(false);
      if ("errors" in result) {
        const { recipients: recipientsError, ...rest } = result.errors;
        if (recipientsError) recipients.setError(recipientsError);
        setErrors(rest);
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
      return;
    }
    toast.success(`Receipt ${result.receiptNumber} made.`);
    router.push(`/receipts/${result.id}` as Route);
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormAlert message={formError} />

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby={`${id}-who`}>
        <h2 id={`${id}-who`} className="font-semibold">
          Who paid
        </h2>
        <div className="grid gap-1.5 sm:max-w-sm">
          <label htmlFor={`${id}-kind`} className="text-sm font-medium">
            Title
          </label>
          <NativeSelect {...field("kind")} value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
            {props.kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.title}
              </option>
            ))}
          </NativeSelect>
          {fieldError("kind")}
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Received from</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["customer", "A customer"],
                ["someone", "Someone else"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`${id}-payer-mode`} checked={payerMode === value} onChange={() => choosePayer(value)} className="size-4 accent-primary" />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
        {payerMode === "customer" && (
          <div className="sm:max-w-sm">
            <AsyncCombobox<ReceiptCustomerChoice>
              label="Customer"
              placeholder="Search your customers"
              value={customer}
              onValueChange={chooseCustomer}
              search={searchReceiptCustomersAction}
              itemKey={(c) => c.id}
              itemLabel={(c) => c.displayName}
              renderItem={(c) => (
                <span className="grid">
                  <span className="font-medium">{c.displayName}</span>
                  {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
                </span>
              )}
            />
          </div>
        )}
        <div className="grid gap-1.5 sm:max-w-sm">
          <label htmlFor={`${id}-payer`} className="text-sm font-medium">
            Payer&apos;s name
          </label>
          <Input
            {...field("payer")}
            maxLength={RECEIPT_LIMITS.payer}
            placeholder={eg(props.payerExample)}
            value={form.payer}
            onChange={(e) => set({ payer: e.target.value })}
          />
          {fieldError("payer") ?? <p className="text-sm text-muted-foreground">Printed on the receipt exactly as typed.</p>}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby={`${id}-money`}>
        <h2 id={`${id}-money`} className="font-semibold">
          The money
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-amount`} className="text-sm font-medium">
              Amount received ({props.currency})
            </label>
            <Input {...field("amount")} inputMode="decimal" placeholder="0.00" className="tabular-nums" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            {fieldError("amount")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-receivedOn`} className="text-sm font-medium">
              Date received
            </label>
            <Input {...field("receivedOn")} type="date" max={props.today} value={form.receivedOn} onChange={(e) => set({ receivedOn: e.target.value })} />
            {fieldError("receivedOn")}
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor={`${id}-purpose`} className="text-sm font-medium">
              Received for
            </label>
            <Input
              {...field("purpose")}
              maxLength={RECEIPT_LIMITS.purpose}
              placeholder={eg(props.purposeExample)}
              value={form.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            />
            {fieldError("purpose")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-method`} className="text-sm font-medium">
              Method
            </label>
            <NativeSelect {...field("method")} value={form.method} onChange={(e) => set({ method: e.target.value })}>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {props.methodLabels[value]}
                </option>
              ))}
            </NativeSelect>
            {fieldError("method")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-reference`} className="text-sm font-medium">
              {labels.reference} <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input {...field("reference")} maxLength={PAYMENT_LIMITS.reference} placeholder={eg(examples.reference)} value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
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
                value={form.institution}
                onChange={(e) => set({ institution: e.target.value })}
              />
              {fieldError("institution")}
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-paidTime`} className="text-sm font-medium">
              Time received <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input {...field("paidTime")} type="time" value={form.paidTime} onChange={(e) => set({ paidTime: e.target.value })} />
            {fieldError("paidTime")}
          </div>
          {form.method === "cheque" && (
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-chequeDate`} className="text-sm font-medium">
                {props.chequeDateLabel} <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input {...field("chequeDate")} type="date" value={form.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} />
              {fieldError("chequeDate")}
            </div>
          )}
          <div className="grid gap-1.5 sm:col-span-2">
            <label htmlFor={`${id}-notes`} className="text-sm font-medium">
              Notes <span className="font-normal text-muted-foreground">(optional, printed under what it was for)</span>
            </label>
            <Textarea {...field("notes")} rows={2} maxLength={RECEIPT_LIMITS.notes} placeholder="e.g. Paid in two parts." value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            {fieldError("notes")}
          </div>
        </div>
      </section>

      <fieldset className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <legend className="px-1 text-sm font-medium">Email a copy</legend>
        {customerEmail && (
          <label htmlFor={`${id}-send-customer`} className="flex items-start gap-2 text-sm">
            <Checkbox id={`${id}-send-customer`} checked={sendToCustomer} onCheckedChange={(checked) => setSendToCustomer(checked === true)} className="mt-0.5" />
            <span>Email a copy to {customerEmail}</span>
          </label>
        )}
        <RecipientsField recipients={recipients} label={customerEmail ? "Also send to another email" : "Send to an email"} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" pending={pending} pendingLabel="Making…">
          Make receipt
        </Button>
        <p className="text-sm text-muted-foreground">It&apos;s numbered at once and can&apos;t be edited. If it&apos;s wrong, void it.</p>
      </div>
    </form>
  );
}
