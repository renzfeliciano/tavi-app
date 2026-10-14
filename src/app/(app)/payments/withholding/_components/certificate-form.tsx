"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { MarketExamples } from "@/config/markets";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_LABEL } from "@/modules/files/client";
import {
  defaultTaxWithheld,
  monthNamesOfQuarter,
  type Quarter,
  quarterBounds,
  type RawCertificate,
  type RawCertificateLine,
  reconcile,
  WITHHOLDING_LIMITS,
} from "@/modules/payments/client";
import { formatAmountForInput, formatMoney, parseMoneyInput } from "@/shared/money";
import { parseDecimalInput } from "@/shared/numbers/decimal-input";
import { eg } from "@/shared/text/example";
import { recordCertificateAction, updateCertificateAction } from "../actions";
import { rateText } from "../_lib/form-data";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const OTHER = "other";
const YEARS_BACK = 4;

/** A payment with tax withheld that can go on this certificate (the module's `PendingPayment`, as the form needs it). */
export type FormPayment = {
  paymentId: string;
  receiptNumber: string;
  paidOn: string;
  invoiceNumber: string | null;
  withheldMinor: number;
};

export type CertificateFormProps = {
  /** Set when editing; the form then saves changes to this certificate. */
  certificateId?: string;
  customerName: string;
  initial: RawCertificate;
  pendingPayments: readonly FormPayment[];
  atcs: readonly { code: string; rateBps: number }[];
  currency: string;
  locale: string;
  today: string;
  certificate: { name: string; short: string };
  tinLabel: string;
  tinExample: string;
  examples: MarketExamples;
  scan: { fileName: string; href: string } | null;
  cancelHref?: string;
};

type LineState = {
  /** "" (not chosen yet), a known ATC's code, or "other" (the person types the code). */
  atc: string;
  atcCode: string;
  description: string;
  rate: string;
  month1: string;
  month2: string;
  month3: string;
  taxWithheld: string;
  /** The person typed the tax: stop suggesting it from the rate. */
  taxEdited: boolean;
};

const blankLine: LineState = {
  atc: "",
  atcCode: "",
  description: "",
  rate: "",
  month1: "",
  month2: "",
  month3: "",
  taxWithheld: "",
  taxEdited: false,
};

function toLineState(raw: RawCertificateLine, atcs: CertificateFormProps["atcs"]): LineState {
  const code = raw.atcCode.trim().toUpperCase();
  const known = atcs.find((atc) => atc.code === code);
  return {
    atc: known ? known.code : code ? OTHER : "",
    atcCode: raw.atcCode,
    description: raw.description,
    rate: raw.rate,
    month1: raw.month1,
    month2: raw.month2,
    month3: raw.month3,
    taxWithheld: raw.taxWithheld,
    taxEdited: raw.taxWithheld.trim() !== "",
  };
}

export function CertificateForm(props: CertificateFormProps) {
  const { certificateId, atcs, currency, locale, today, certificate, examples } = props;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  const [payorTin, setPayorTin] = useState(props.initial.payorTin);
  const [payorName, setPayorName] = useState(props.initial.payorName);
  const [payorAddress, setPayorAddress] = useState(props.initial.payorAddress);
  const [year, setYear] = useState(props.initial.year);
  const [quarter, setQuarter] = useState(props.initial.quarter);
  const [receivedOn, setReceivedOn] = useState(props.initial.receivedOn);
  const [notes, setNotes] = useState(props.initial.notes);
  const [lines, setLines] = useState<LineState[]>(() =>
    (props.initial.lines.length > 0 ? props.initial.lines : [blankLine]).map((line) => toLineState(line, atcs)),
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(props.initial.paymentIds));
  const [picked, setPicked] = useState<File | null>(null);
  const [removeScan, setRemoveScan] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  const short = certificate.short;
  const quarterNumber = Number(quarter) as Quarter;
  const periodOk = /^\d{4}$/.test(year) && [1, 2, 3, 4].includes(quarterNumber);
  const months = periodOk ? monthNamesOfQuarter(quarterNumber, locale) : null;
  const bounds = periodOk ? quarterBounds(Number(year), quarterNumber) : null;
  const visible = bounds ? props.pendingPayments.filter((p) => p.paidOn >= bounds.from && p.paidOn <= bounds.to) : [];
  const ticked = visible.filter((p) => selected.has(p.paymentId));

  const thisYear = Number(today.slice(0, 4));
  const years = Array.from(new Set([...Array.from({ length: YEARS_BACK + 1 }, (_, i) => thisYear - i), Number(props.initial.year)]))
    .filter((y) => Number.isInteger(y))
    .sort((a, b) => b - a);

  // Moves focus to the first field with a problem, after the form has re-rendered with the messages.
  useEffect(() => {
    if (submitCount === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitCount]);

  const money = (minor: number) => formatMoney(minor, currency, { locale });
  const amountMinor = (text: string) => (text.trim() === "" ? 0 : (parseMoneyInput(text, currency, locale) ?? 0));
  const totalOf = (line: LineState) => amountMinor(line.month1) + amountMinor(line.month2) + amountMinor(line.month3);

  /** Suggests the tax withheld from the rate until the person types what the form says. */
  function withSuggestedTax(line: LineState): LineState {
    if (line.taxEdited) return line;
    const bps = parseDecimalInput(line.rate, { locale, scale: 2, maxWholeDigits: 3 });
    const total = totalOf(line);
    const tax = bps === null || total <= 0 ? 0 : defaultTaxWithheld(total, bps);
    return { ...line, taxWithheld: tax > 0 ? formatAmountForInput(tax, currency, locale) : "" };
  }

  function changeLine(index: number, change: Partial<LineState>) {
    setLines((all) => all.map((line, i) => (i === index ? withSuggestedTax({ ...line, ...change }) : line)));
  }

  function pickAtc(index: number, code: string) {
    const known = atcs.find((atc) => atc.code === code);
    changeLine(index, known ? { atc: code, atcCode: code, rate: rateText(known.rateBps) } : { atc: code, atcCode: "" });
  }

  function changePeriod(nextYear: string, nextQuarter: string) {
    setYear(nextYear);
    setQuarter(nextQuarter);
    const next = /^\d{4}$/.test(nextYear) && /^[1-4]$/.test(nextQuarter) ? quarterBounds(Number(nextYear), Number(nextQuarter) as Quarter) : null;
    const inPeriod = next ? props.pendingPayments.filter((p) => p.paidOn >= next.from && p.paidOn <= next.to) : [];
    // A new certificate covers everything waiting in its quarter; an edited one keeps only what it already covered.
    setSelected(new Set(inPeriod.filter((p) => !certificateId || selected.has(p.paymentId)).map((p) => p.paymentId)));
  }

  function toggle(paymentId: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(paymentId);
      else next.delete(paymentId);
      return next;
    });
  }

  function onChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "scan")));
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setErrors((current) => ({ ...current, scan: DOCUMENT_MESSAGES.tooLarge }));
      event.target.value = "";
      return setPicked(null);
    }
    setPicked(file);
  }

  const certificateTax = lines.reduce((sum, line) => sum + amountMinor(line.taxWithheld), 0);
  const linkedTax = ticked.reduce((sum, p) => sum + p.withheldMinor, 0);
  const comparison = reconcile(certificateTax, linkedTax);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setErrors({});
    setFormError(null);

    const data: RawCertificate = {
      customerId: props.initial.customerId,
      payorTin,
      payorName,
      payorAddress,
      year,
      quarter,
      receivedOn,
      notes,
      lines: lines.map((line) => ({
        atcCode: line.atc === OTHER ? line.atcCode : line.atc,
        description: line.description,
        rate: line.rate,
        month1: line.month1,
        month2: line.month2,
        month3: line.month3,
        taxWithheld: line.taxWithheld,
      })),
      paymentIds: ticked.map((p) => p.paymentId),
    };
    const form = new FormData();
    form.set("data", JSON.stringify(data));
    if (picked) form.set("scan", picked);
    else if (removeScan) form.set("removeScan", "1");

    try {
      const result = certificateId ? await updateCertificateAction(certificateId, form) : await recordCertificateAction(form);
      if (result.ok) {
        toast.success(certificateId ? `${short} saved.` : `${short} recorded.`);
        router.push(`/payments/withholding/${result.id}` as Route);
        return;
      }
      if ("errors" in result) setErrors(result.errors);
      else setFormError(result.error);
      setSubmitCount((count) => count + 1);
    } catch {
      setFormError("Couldn't save. Please try again.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  const existingScan = props.scan && !removeScan ? props.scan : null;
  const sample = atcs[0];
  const lineError = (index: number, field: string) => errors[`lines.${index}.${field}`];

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormAlert message={formError ?? errors.customerId} />

      <FormSection title={`Who withheld the tax`} description={`From the ${certificate.name}, "Payor" part. This is the customer ${props.customerName}, or the company paying on their behalf.`}>
        <FormField name="payorTin" label={`Payor's ${props.tinLabel}`} error={errors.payorTin}>
          {(control) => (
            <Input
              {...control}
              value={payorTin}
              onChange={(event) => setPayorTin(event.target.value)}
              maxLength={WITHHOLDING_LIMITS.tin}
              inputMode="numeric"
              autoComplete="off"
              placeholder={eg(props.tinExample)}
            />
          )}
        </FormField>
        <FormField name="payorName" label="Payor's name" error={errors.payorName}>
          {(control) => (
            <Input
              {...control}
              value={payorName}
              onChange={(event) => setPayorName(event.target.value)}
              maxLength={WITHHOLDING_LIMITS.name}
              autoComplete="off"
              placeholder={eg(examples.company)}
            />
          )}
        </FormField>
        <FormField name="payorAddress" label="Payor's address" optional error={errors.payorAddress} className="sm:col-span-2">
          {(control) => (
            <Input
              {...control}
              value={payorAddress}
              onChange={(event) => setPayorAddress(event.target.value)}
              maxLength={WITHHOLDING_LIMITS.address}
              autoComplete="off"
              placeholder={eg(examples.address.line1)}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection title="Period and date" description="The calendar quarter printed on the certificate, and the day it reached you.">
        <FormField name="year" label="Year" error={undefined}>
          {(control) => (
            <NativeSelect {...control} value={year} onChange={(event) => changePeriod(event.target.value, quarter)}>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField name="quarter" label="Quarter" error={errors.quarter}>
          {(control) => (
            <NativeSelect {...control} value={quarter} onChange={(event) => changePeriod(year, event.target.value)}>
              {([1, 2, 3, 4] as const).map((q) => {
                const names = monthNamesOfQuarter(q, locale);
                return (
                  <option key={q} value={String(q)}>
                    {`Q${q}: ${names[0]} to ${names[2]}`}
                  </option>
                );
              })}
            </NativeSelect>
          )}
        </FormField>
        <FormField name="receivedOn" label="Date received" error={errors.receivedOn}>
          {(control) => <Input {...control} type="date" value={receivedOn} max={today} onChange={(event) => setReceivedOn(event.target.value)} />}
        </FormField>
      </FormSection>

      <section aria-labelledby="income-heading" className="rounded-xl border border-border bg-card shadow-xs">
        <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
          <h2 id="income-heading" className="font-semibold">
            Income payments and tax withheld
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">One row for each line of the certificate, up to {WITHHOLDING_LIMITS.maxRows}.</p>
        </header>
        <div className="grid gap-5 px-5 py-5 sm:px-6">
          {lines.map((line, index) => {
            const total = totalOf(line);
            const rowKey = `line-${index}`;
            return (
              <fieldset key={index} className="grid gap-4 border-b border-border pb-5 last:border-b-0 last:pb-0">
                {lines.length > 1 && (
                  <legend className="flex w-full items-center justify-between gap-3 text-sm font-medium">
                    <span>Row {index + 1}</span>
                  </legend>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    name="atc"
                    id={`${rowKey}-atc`}
                    label="ATC"
                    error={line.atc === OTHER ? undefined : lineError(index, "atcCode")}
                  >
                    {(control) => (
                      <NativeSelect {...control} value={line.atc} onChange={(event) => pickAtc(index, event.target.value)}>
                        <option value="">Choose…</option>
                        {atcs.map((atc) => (
                          <option key={atc.code} value={atc.code}>
                            {`${atc.code} (${rateText(atc.rateBps)}%)`}
                          </option>
                        ))}
                        <option value={OTHER}>Other</option>
                      </NativeSelect>
                    )}
                  </FormField>
                  <FormField name="rate" id={`${rowKey}-rate`} label="Rate (%)" error={lineError(index, "rate")}>
                    {(control) => (
                      <Input
                        {...control}
                        value={line.rate}
                        onChange={(event) => changeLine(index, { rate: event.target.value })}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={eg(sample ? rateText(sample.rateBps) : "2")}
                      />
                    )}
                  </FormField>
                  {line.atc === OTHER && (
                    <FormField name="atcCode" id={`${rowKey}-atcCode`} label="ATC code" error={lineError(index, "atcCode")}>
                      {(control) => (
                        <Input
                          {...control}
                          value={line.atcCode}
                          onChange={(event) => changeLine(index, { atcCode: event.target.value })}
                          maxLength={WITHHOLDING_LIMITS.atc}
                          autoComplete="off"
                          placeholder={eg(sample?.code ?? "WI160")}
                        />
                      )}
                    </FormField>
                  )}
                  <FormField
                    name="description"
                    id={`${rowKey}-description`}
                    label="Kind of income payment"
                    optional
                    error={lineError(index, "description")}
                    className={line.atc === OTHER ? undefined : "sm:col-span-2"}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={line.description}
                        onChange={(event) => changeLine(index, { description: event.target.value })}
                        maxLength={WITHHOLDING_LIMITS.description}
                        autoComplete="off"
                        placeholder={eg("Professional fees")}
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {([1, 2, 3] as const).map((n) => {
                    const key = `month${n}` as "month1" | "month2" | "month3";
                    return (
                      <FormField key={key} name={key} id={`${rowKey}-${key}`} label={months?.[n - 1] ?? `Month ${n}`} error={lineError(index, key)}>
                        {(control) => (
                          <Input
                            {...control}
                            value={line[key]}
                            onChange={(event) => changeLine(index, { [key]: event.target.value })}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            className="tabular-nums"
                          />
                        )}
                      </FormField>
                    );
                  })}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                  <div className="grid gap-1">
                    <p className="text-sm font-medium tabular-nums">Total income payments {money(total)}</p>
                    {lineError(index, "total") && <p className="text-sm text-danger-strong">{lineError(index, "total")}</p>}
                  </div>
                  <FormField
                    name="taxWithheld"
                    id={`${rowKey}-taxWithheld`}
                    label="Tax withheld"
                    hint="Fills in from the rate. Type the figure on the form if it differs."
                    error={lineError(index, "taxWithheld")}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={line.taxWithheld}
                        onChange={(event) => changeLine(index, { taxWithheld: event.target.value, taxEdited: event.target.value.trim() !== "" })}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        className="tabular-nums"
                      />
                    )}
                  </FormField>
                </div>

                {lines.length > 1 && (
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setLines((all) => all.filter((_, i) => i !== index))}
                    >
                      <XIcon aria-hidden="true" />
                      Remove row
                    </Button>
                  </div>
                )}
              </fieldset>
            );
          })}
          {errors.lines && <p className="text-sm text-danger-strong">{errors.lines}</p>}
          {lines.length < WITHHOLDING_LIMITS.maxRows && (
            <div>
              <Button type="button" variant="outline" onClick={() => setLines((all) => [...all, { ...blankLine }])}>
                <PlusIcon aria-hidden="true" />
                Add a row
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <fieldset className="grid gap-3 px-5 py-5 sm:px-6">
          <legend className="mb-1 font-semibold">Payments this covers</legend>
          {visible.length === 0 ? (
            <p className="text-sm text-pretty text-muted-foreground">
              No payments with tax withheld are waiting in this quarter. You can still save the {short}: it can cover payments made outside Tavi.
            </p>
          ) : (
            <>
              <p className="text-sm text-pretty text-muted-foreground">
                Tick the payments this {short} accounts for. Each payment can be on one {short} only.
              </p>
              <ul className="grid gap-1">
                {visible.map((p) => {
                  const label = [p.receiptNumber, p.invoiceNumber, p.paidOn, money(p.withheldMinor)].filter(Boolean).join(" · ");
                  return (
                    <li key={p.paymentId}>
                      <label className="flex min-h-9 items-center gap-2.5 py-1 text-sm pointer-coarse:min-h-11">
                        <Checkbox
                          checked={selected.has(p.paymentId)}
                          onCheckedChange={(checked) => toggle(p.paymentId, checked === true)}
                          aria-label={label}
                        />
                        <span className="tabular-nums">{label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {errors.paymentIds && <p className="text-sm text-danger-strong">{errors.paymentIds}</p>}
          {ticked.length > 0 && (
            <p role="status" aria-label="Comparison with payments" className="text-sm text-pretty">
              {comparison.matches
                ? `Matches the tax withheld on the ${ticked.length === 1 ? "payment" : "payments"} ticked.`
                : `Differs by ${money(Math.abs(comparison.differenceMinor))} from the tax withheld on the ${ticked.length === 1 ? "payment" : "payments"} ticked. That's fine if the ${short} covers payments made outside Tavi.`}
            </p>
          )}
        </fieldset>
      </section>

      <FormSection title="Scan and notes" description={`Keep the paper ${short} with the record: a PDF, or a photo of it (up to ${MAX_UPLOAD_SIZE_LABEL}).`}>
        <div className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-medium">Scan or photo</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={onChosen}
            className="sr-only"
            aria-label="Scan or photo file"
            tabIndex={-1}
          />
          <div className="flex flex-wrap items-center gap-2">
            {existingScan && (
              <>
                <a href={existingScan.href} className="text-sm font-medium text-primary-text underline-offset-4 hover:underline">
                  {existingScan.fileName}
                </a>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveScan(true)}>
                  Remove scan
                </Button>
              </>
            )}
            {picked ? (
              <>
                <span className="text-sm">{picked.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPicked(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                {existingScan ? "Replace the scan" : "Attach a scan"}
              </Button>
            )}
          </div>
          {errors.scan && <p className="text-sm text-danger-strong">{errors.scan}</p>}
        </div>
        <FormField name="notes" label="Notes" optional error={errors.notes} className="sm:col-span-2">
          {(control) => (
            <Textarea
              {...control}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={WITHHOLDING_LIMITS.notes}
              rows={3}
              placeholder={eg("Received by email from their accounting team")}
            />
          )}
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          {certificateId ? "Save changes" : `Save ${short}`}
        </Button>
        <Link href={(props.cancelHref ?? "/payments/withholding") as Route} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
