"use client";

import { useId, useRef, useState, useTransition } from "react";
import { PlusIcon, QrCodeIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { PaymentQrCode } from "@/components/document/payment-qr";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_QR_LIMITS, type PaymentQr } from "@/modules/organizations/client";
import { decodeQrFile } from "@/shared/qr/qr-decode";
import { canDrawQr } from "@/shared/qr/qr-matrix";
import { savePaymentQrs } from "./actions";

type Row = PaymentQr & { key: string };

const NOT_FOUND =
  "We couldn't find a QR code in that picture. Try a sharper, cropped screenshot of just the code, or paste the link instead.";

/** A preview only when the text can be drawn; the server checks it again on save. */
function Preview({ value, label }: { value: string; label: string }) {
  const text = value.trim();
  if (text === "" || !canDrawQr(text)) return null;
  return <PaymentQrCode value={text} label={label || "Payment"} className="size-28 rounded-sm border border-border" />;
}

/**
 * The payment QR codes printed on quotes and invoices (up to three). The
 * business pastes a payment link or the QR's code, or uploads a screenshot
 * that is read right here in the browser; only the text is saved, and Tavi
 * redraws the code clean. The same codes appear on every document.
 */
export function PaymentQrEditor({
  initial,
  editable,
  where,
}: {
  initial: PaymentQr[];
  editable: boolean;
  /** e.g. "quotations and billing statements". */
  where: string;
}) {
  const id = useId();
  const nextKey = useRef(initial.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef<number | null>(null);
  const [rows, setRows] = useState<Row[]>(() => initial.map((qr, index) => ({ ...qr, key: `r${index}` })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();
  const [saved, setSaved] = useState(initial);

  const plain = (list: Row[]) => list.map(({ label, value, enabled }) => ({ label, value, enabled }));
  const dirty = JSON.stringify(plain(rows)) !== JSON.stringify(saved);

  const change = (index: number, patch: Partial<PaymentQr>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch)) delete next[`${index}.${field}`];
      delete next.form;
      return next;
    });
  };

  async function onFile(file: File | undefined) {
    const index = reading.current;
    reading.current = null;
    if (fileInput.current) fileInput.current.value = "";
    if (!file || index === null) return;
    let text: string | null = null;
    try {
      text = await decodeQrFile(file);
    } catch {
      text = null;
    }
    if (!text) {
      toast.error(NOT_FOUND);
      return;
    }
    change(index, { value: text });
    toast.success("QR code read.", { description: "Check the preview, name it, then save." });
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await savePaymentQrs(plain(rows));
      if (result.ok) {
        // Blank rows are dropped on the server; do the same here so what shows is what's saved.
        const kept = rows.filter((row) => row.label.trim() !== "" || row.value.trim() !== "");
        const clean = plain(kept).map((qr) => ({ ...qr, label: qr.label.trim(), value: qr.value.trim() }));
        setRows(kept.map((row, i) => ({ ...row, ...clean[i]! })));
        setSaved(clean);
        setErrors({});
        toast.success(clean.length > 0 ? "Payment QR codes saved." : "Payment QR codes removed.", {
          description: clean.length > 0 ? "Shown on the documents you send from now on." : undefined,
        });
        return;
      }
      if ("errors" in result) {
        setErrors(result.errors);
        setFormError(result.errors.form ?? null);
        toast.error("Couldn't save. Check the highlighted fields.");
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <section id="payment-qr" aria-labelledby={`${id}-heading`} className="scroll-mt-20 rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id={`${id}-heading`} className="font-semibold">
          Payment QR codes
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Customers scan these to pay you. They print on your {where}, in their PDFs and in the emails you send, with no amount, so the same code works every time. A
          document keeps the codes it was sent with.
        </p>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:px-6">
        {rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCodeIcon aria-hidden="true" className="size-4" />
            No QR codes yet.
          </p>
        )}
        <ul className="grid gap-4">
          {rows.map((row, index) => {
            const labelId = `${id}-${row.key}-label`;
            const valueId = `${id}-${row.key}-value`;
            const labelError = errors[`${index}.label`];
            const valueError = errors[`${index}.value`];
            return (
              <li key={row.key} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor={labelId} className="text-sm font-medium">
                      Name
                    </label>
                    <Input
                      id={labelId}
                      value={row.label}
                      maxLength={PAYMENT_QR_LIMITS.label}
                      placeholder="e.g. GCash"
                      disabled={!editable}
                      aria-invalid={labelError ? true : undefined}
                      aria-describedby={labelError ? `${labelId}-error` : undefined}
                      onChange={(e) => change(index, { label: e.target.value })}
                    />
                    {labelError && (
                      <p id={`${labelId}-error`} className="text-sm text-destructive">
                        {labelError}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor={valueId} className="text-sm font-medium">
                      Payment link or QR code text
                    </label>
                    <Textarea
                      id={valueId}
                      rows={2}
                      value={row.value}
                      maxLength={PAYMENT_QR_LIMITS.value}
                      placeholder="https://… or 000201…"
                      disabled={!editable}
                      className="font-mono text-xs"
                      aria-invalid={valueError ? true : undefined}
                      aria-describedby={valueError ? `${valueId}-error` : `${valueId}-hint`}
                      onChange={(e) => change(index, { value: e.target.value })}
                    />
                    {valueError ? (
                      <p id={`${valueId}-error`} className="text-sm text-destructive">
                        {valueError}
                      </p>
                    ) : (
                      <p id={`${valueId}-hint`} className="text-sm text-muted-foreground">
                        Paste it, or upload a screenshot of the QR and we&apos;ll read it. The picture isn&apos;t kept.
                      </p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          reading.current = index;
                          fileInput.current?.click();
                        }}
                      >
                        <UploadIcon aria-hidden="true" />
                        Upload screenshot
                      </Button>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={row.enabled} onCheckedChange={(checked) => change(index, { enabled: checked === true })} />
                        Show on documents
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setRows((current) => current.filter((_, i) => i !== index));
                          setErrors({});
                        }}
                      >
                        <Trash2Icon aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <div className={`grid content-start justify-items-center gap-1 ${row.enabled ? "" : "opacity-50"}`}>
                  <Preview value={row.value} label={row.label} />
                  {row.value.trim() !== "" && !row.enabled && <span className="text-xs text-muted-foreground">Hidden</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="QR code screenshot"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <FormAlert message={formError} />
        {editable && (
          <div className="flex flex-wrap gap-2">
            {rows.length < PAYMENT_QR_LIMITS.count && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  nextKey.current += 1;
                  setRows((current) => [...current, { key: `r${nextKey.current}`, label: "", value: "", enabled: true }]);
                }}
              >
                <PlusIcon aria-hidden="true" />
                Add a QR code
              </Button>
            )}
            <Button type="button" disabled={!dirty} pending={pending} pendingLabel="Saving…" onClick={save}>
              Save QR codes
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
