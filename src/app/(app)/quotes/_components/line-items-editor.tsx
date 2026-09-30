"use client";

import { ArrowDownIcon, ArrowUpIcon, PercentIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DOCUMENT_LIMITS, type RawLine } from "@/modules/documents/client";
import type { TaxRateChoice } from "../_lib/editor-types";

export type EditorLine = RawLine & { key: string };

type LineItemsEditorProps = {
  lines: EditorLine[];
  /** Line amounts already formatted, by line key (from the live calculation). */
  amounts: Record<string, string>;
  currency: string;
  taxRates: TaxRateChoice[];
  /** Errors to show, keyed `lines.<index>.<field>`. */
  errors: Record<string, string>;
  onChange: (key: string, patch: Partial<RawLine>) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onRemove: (key: string) => void;
  onTouch: (field: string) => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function LineItemsEditor({
  lines,
  amounts,
  currency,
  taxRates,
  errors,
  onChange,
  onMove,
  onRemove,
  onTouch,
}: LineItemsEditorProps) {
  return (
    <ol className="grid gap-3" aria-label="Line items">
      {lines.map((line, index) => {
        const n = index + 1;
        const key = (field: keyof RawLine) => `lines.${index}.${field}`;
        const id = (field: keyof RawLine) => `line-${line.key}-${field}`;
        const error = (field: keyof RawLine) => errors[key(field)];
        const described = (field: keyof RawLine) => (error(field) ? `${id(field)}-error` : undefined);
        const control = (field: keyof RawLine) => ({
          id: id(field),
          "aria-invalid": error(field) ? true : undefined,
          "aria-describedby": described(field),
          onBlur: () => onTouch(key(field)),
        });

        return (
          <li key={line.key} className="rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-2 grid size-6 shrink-0 place-items-center rounded-full border border-border-strong font-mono text-xs text-muted-foreground tabular-nums"
              >
                {n}
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <label htmlFor={id("description")} className="sr-only">
                  Line {n} description
                </label>
                <Textarea
                  {...control("description")}
                  value={line.description}
                  onChange={(e) => onChange(line.key, { description: e.target.value })}
                  maxLength={DOCUMENT_LIMITS.description}
                  rows={1}
                  placeholder="What you're doing or selling"
                  className="min-h-9 resize-none"
                />
                <FieldError id={`${id("description")}-error`} message={error("description")} />
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move line ${n} up`}
                  disabled={index === 0}
                  onClick={() => onMove(line.key, -1)}
                >
                  <ArrowUpIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move line ${n} down`}
                  disabled={index === lines.length - 1}
                  onClick={() => onMove(line.key, 1)}
                >
                  <ArrowDownIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${n}`}
                  onClick={() => onRemove(line.key)}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:ml-8 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-1">
                <label htmlFor={id("quantity")} className="text-xs text-muted-foreground">
                  Qty
                </label>
                <Input
                  {...control("quantity")}
                  value={line.quantity}
                  onChange={(e) => onChange(line.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  className="font-mono tabular-nums"
                />
                <FieldError id={`${id("quantity")}-error`} message={error("quantity")} />
              </div>
              <div className="grid gap-1">
                <label htmlFor={id("unitLabel")} className="text-xs text-muted-foreground">
                  Unit
                </label>
                <Input
                  {...control("unitLabel")}
                  value={line.unitLabel}
                  onChange={(e) => onChange(line.key, { unitLabel: e.target.value })}
                  maxLength={DOCUMENT_LIMITS.unitLabel}
                />
                <FieldError id={`${id("unitLabel")}-error`} message={error("unitLabel")} />
              </div>
              <div className="grid gap-1">
                <label htmlFor={id("unitPrice")} className="text-xs text-muted-foreground">
                  Price ({currency})
                </label>
                <Input
                  {...control("unitPrice")}
                  value={line.unitPrice}
                  onChange={(e) => onChange(line.key, { unitPrice: e.target.value })}
                  inputMode="decimal"
                  className="font-mono tabular-nums"
                />
                <FieldError id={`${id("unitPrice")}-error`} message={error("unitPrice")} />
              </div>
              <div className="grid gap-1">
                <label htmlFor={id("taxRateId")} className="text-xs text-muted-foreground">
                  Tax
                </label>
                <NativeSelect
                  {...control("taxRateId")}
                  value={line.taxRateId}
                  onChange={(e) => onChange(line.key, { taxRateId: e.target.value })}
                >
                  <option value="">No tax</option>
                  {taxRates
                    .filter((rate) => !rate.archived || rate.id === line.taxRateId)
                    .map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        {rate.label}
                      </option>
                    ))}
                </NativeSelect>
                <FieldError id={`${id("taxRateId")}-error`} message={error("taxRateId")} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3 sm:ml-8">
              <div className="flex items-end gap-2">
                <div className="grid gap-1">
                  <label htmlFor={id("discountKind")} className="text-xs text-muted-foreground">
                    Discount
                  </label>
                  <NativeSelect
                    id={id("discountKind")}
                    value={line.discountKind}
                    onChange={(e) =>
                      onChange(line.key, { discountKind: e.target.value as RawLine["discountKind"], discountValue: "" })
                    }
                    className="w-32"
                  >
                    <option value="none">None</option>
                    <option value="percent">Percent</option>
                    <option value="amount">Amount</option>
                  </NativeSelect>
                </div>
                {line.discountKind !== "none" && (
                  <div className="grid gap-1">
                    <label htmlFor={id("discountValue")} className="sr-only">
                      Line {n} discount {line.discountKind === "percent" ? "percent" : `in ${currency}`}
                    </label>
                    <div className="relative">
                      <Input
                        {...control("discountValue")}
                        value={line.discountValue}
                        onChange={(e) => onChange(line.key, { discountValue: e.target.value })}
                        inputMode="decimal"
                        className={cn("w-28 font-mono tabular-nums", line.discountKind === "percent" && "pr-8")}
                      />
                      {line.discountKind === "percent" && (
                        <PercentIcon
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Amount </span>
                <span className="font-medium tabular-nums">{amounts[line.key] ?? "—"}</span>
              </p>
            </div>
            <FieldError id={`${id("discountValue")}-error`} message={error("discountValue")} />
          </li>
        );
      })}
    </ol>
  );
}
