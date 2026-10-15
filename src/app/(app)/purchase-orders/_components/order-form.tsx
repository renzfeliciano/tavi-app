"use client";

import { useId, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/async-combobox";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  blankLine,
  calculateDocument,
  parseDocumentLines,
  type RawLine,
  type TaxMode,
} from "@/modules/documents/client";
import {
  PO_LIMITS,
  parsePurchaseOrderDraft,
  readinessToIssue,
} from "@/modules/purchasing/client";
import { formatMoney } from "@/shared/money";
import { eg } from "@/shared/text/example";
import type { TaxRateChoice } from "../../_documents/editor-types";
import {
  type EditorLine,
  LineItemsEditor,
} from "../../_documents/line-items-editor";
import {
  issuePurchaseOrderAction,
  savePurchaseOrderDraftAction,
  searchSuppliersAction,
  type SupplierChoice,
} from "../actions";
import { type IssueEmail, IssueOrderDialog } from "./issue-order-dialog";

export type OrderFormProps = {
  /** The saved draft being edited, or null for a new one (nothing is saved until the first Save). */
  orderId: string | null;
  initial: {
    supplier: SupplierChoice | null;
    currency: string;
    orderDate: string;
    expectedDate: string;
    notes: string;
    terms: string;
    lines: EditorLine[];
  };
  currencies: { code: string; label: string }[];
  taxRates: TaxRateChoice[];
  defaultTaxRateId: string | null;
  taxMode: TaxMode;
  units: readonly string[];
  defaultUnit: string;
  lineExample: string | null;
  locale: string;
  /** Sending an order needs the person's own address confirmed. */
  emailVerified: boolean;
  /** What the email field shows while empty, from the market. */
  emailExample: string;
};

type Header = {
  currency: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  terms: string;
};

let keySeed = 0;
const newKey = () =>
  `new-${Date.now().toString(36)}-${(keySeed++).toString(36)}`;
const toRawLine = (line: EditorLine): RawLine => ({
  description: line.description,
  quantity: line.quantity,
  unitLabel: line.unitLabel,
  unitPrice: line.unitPrice,
  discountKind: line.discountKind,
  discountValue: line.discountValue,
  taxRateId: line.taxRateId,
  sourceKind: line.sourceKind,
  sourceId: line.sourceId,
});

/**
 * The purchase order form: who it's for, the items, notes and terms. Nothing autosaves; Save draft keeps it as it is,
 * and Issue saves it, numbers it and locks it after one confirmation.
 */
export function OrderForm(props: OrderFormProps) {
  const router = useRouter();
  const id = useId();
  const [supplier, setSupplier] = useState<SupplierChoice | null>(
    props.initial.supplier,
  );
  const [header, setHeader] = useState<Header>({
    currency: props.initial.currency,
    orderDate: props.initial.orderDate,
    expectedDate: props.initial.expectedDate,
    notes: props.initial.notes,
    terms: props.initial.terms,
  });
  const [lines, setLines] = useState<EditorLine[]>(props.initial.lines);
  // A draft saved on the way to issuing keeps its id, so a retry updates it instead of making a second one.
  const [savedId, setSavedId] = useState<string | null>(props.orderId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "issue" | null>(null);
  const [issuing, setIssuing] = useState(false);

  const payload = {
    supplierId: supplier?.id ?? "",
    ...header,
    lines: lines.map(toRawLine),
  };
  const ratesById = useMemo(
    () => new Map(props.taxRates.map((rate) => [rate.id, rate])),
    [props.taxRates],
  );

  // Totals from every line that can already be read, even while others are unfinished.
  const preview = useMemo(() => {
    const rows: {
      key: string;
      line: Parameters<typeof calculateDocument>[0]["lines"][number];
    }[] = [];
    for (const line of lines) {
      const parsed = parseDocumentLines([toRawLine(line)], {
        currency: header.currency,
        locale: props.locale,
      });
      const first = parsed.ok ? parsed.lines[0] : undefined;
      if (!first) continue;
      const rate = first.taxRateId ? ratesById.get(first.taxRateId) : undefined;
      rows.push({
        key: line.key,
        line: {
          quantity: first.quantity,
          unitPriceMinor: first.unitPriceMinor,
          discount: first.discount,
          tax: rate ? { name: rate.name, rateBps: rate.rateBps } : null,
        },
      });
    }
    let amounts;
    try {
      amounts = calculateDocument({
        taxMode: props.taxMode,
        lines: rows.map((row) => row.line),
      });
    } catch {
      amounts = calculateDocument({ taxMode: props.taxMode, lines: [] });
    }
    const money = (minor: number) =>
      formatMoney(minor, header.currency, { locale: props.locale });
    const lineAmounts: Record<string, string> = {};
    rows.forEach((row, index) => {
      const amount = amounts.lines[index];
      if (amount) lineAmounts[row.key] = money(amount.netMinor);
    });
    return {
      lineAmounts,
      subtotal: money(amounts.subtotalMinor),
      discount:
        amounts.discountTotalMinor > 0
          ? money(amounts.discountTotalMinor)
          : null,
      tax: money(amounts.taxTotalMinor),
      total: money(amounts.totalMinor),
    };
  }, [lines, header.currency, props.locale, props.taxMode, ratesById]);

  const edit = (patch: Partial<Header>) => {
    setHeader((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };
  const editLines = (next: EditorLine[]) => {
    setLines(next);
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => key !== "lines" && !key.startsWith("lines."),
        ),
      ),
    );
  };
  const field = (key: string) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null;

  const addLine = () =>
    editLines([
      ...lines,
      {
        ...blankLine(),
        key: newKey(),
        quantity: "1",
        unitLabel: props.defaultUnit,
        taxRateId: props.defaultTaxRateId ?? "",
      },
    ]);
  const changeLine = (key: string, patch: Partial<RawLine>) =>
    editLines(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  const removeLine = (key: string) =>
    editLines(lines.filter((line) => line.key !== key));
  const moveLine = (key: string, direction: -1 | 1) => {
    const from = lines.findIndex((line) => line.key === key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= lines.length) return;
    const next = [...lines];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    editLines(next);
  };

  /** Saves the draft; returns its id, or null after showing what went wrong. */
  async function saveDraft(): Promise<string | null> {
    const parsed = parsePurchaseOrderDraft(payload, {
      locale: props.locale,
      units: props.units,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return null;
    }
    const result = await savePurchaseOrderDraftAction(savedId, payload);
    if (result.ok) {
      setSavedId(result.id);
      return result.id;
    }
    if ("errors" in result) setErrors(result.errors);
    else {
      setFormError(result.error);
      toast.error(result.error);
    }
    return null;
  }

  async function onSave() {
    setPending("save");
    setFormError(null);
    const saved = await saveDraft();
    setPending(null);
    if (!saved) return;
    toast.success("Draft saved.");
    router.push(`/purchase-orders/${saved}` as Route);
  }

  function onIssueClick() {
    setFormError(null);
    const parsed = parsePurchaseOrderDraft(payload, {
      locale: props.locale,
      units: props.units,
    });
    const problems = {
      ...(parsed.ok ? {} : parsed.errors),
      ...readinessToIssue({
        supplierId: supplier?.id ?? null,
        lineCount: lines.length,
      }),
    };
    setErrors(problems);
    if (Object.keys(problems).length === 0) setIssuing(true);
  }

  async function onIssue(email: IssueEmail | null) {
    setPending("issue");
    setFormError(null);
    const saved = await saveDraft();
    if (!saved) {
      setPending(null);
      setIssuing(false);
      return;
    }
    const result = await issuePurchaseOrderAction(saved, email);
    setPending(null);
    if (!result.ok) {
      if ("errors" in result) {
        setErrors(result.errors);
        // An address problem is fixed in the dialog; anything else, back on the form.
        if (!result.errors.emailTo) setIssuing(false);
      } else {
        setIssuing(false);
        setFormError(result.error);
        toast.error(result.error);
      }
      return;
    }
    toast.success(`${result.number} issued.`);
    router.push(`/purchase-orders/${saved}` as Route);
  }

  const busy = pending !== null;
  const section =
    "grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6";

  return (
    <>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <FormAlert message={formError} />

        <section className={section} aria-labelledby={`${id}-who`}>
          <h2 id={`${id}-who`} className="font-semibold">
            Supplier
          </h2>
          <div className="grid gap-1.5 sm:max-w-sm">
            <AsyncCombobox<SupplierChoice>
              label="Supplier"
              placeholder="Search your suppliers"
              value={supplier}
              onValueChange={(next) => {
                setSupplier(next);
                setErrors((current) =>
                  Object.fromEntries(
                    Object.entries(current).filter(
                      ([key]) => key !== "supplierId",
                    ),
                  ),
                );
              }}
              search={searchSuppliersAction}
              itemKey={(s) => s.id}
              itemLabel={(s) => s.displayName}
              renderItem={(s) => (
                <span className="grid">
                  <span className="font-medium">{s.displayName}</span>
                  {s.detail && (
                    <span className="text-xs text-muted-foreground">
                      {s.detail}
                    </span>
                  )}
                </span>
              )}
              invalid={Boolean(errors.supplierId)}
              describedBy={
                errors.supplierId ? `${id}-supplierId-error` : undefined
              }
            />
            {fieldError("supplierId")}
            <p className="text-sm text-muted-foreground">
              Not listed?{" "}
              <Link
                href={"/suppliers/new" as Route}
                className="font-medium underline underline-offset-2"
              >
                Add a supplier
              </Link>
            </p>
          </div>
        </section>

        <section className={section} aria-labelledby={`${id}-details`}>
          <h2 id={`${id}-details`} className="font-semibold">
            Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-currency`} className="text-sm font-medium">
                Currency
              </label>
              <NativeSelect
                {...field("currency")}
                value={header.currency}
                onChange={(e) => edit({ currency: e.target.value })}
              >
                {props.currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </NativeSelect>
              {fieldError("currency")}
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor={`${id}-orderDate`}
                className="text-sm font-medium"
              >
                Order date
              </label>
              <Input
                {...field("orderDate")}
                type="date"
                value={header.orderDate}
                onChange={(e) => edit({ orderDate: e.target.value })}
              />
              {fieldError("orderDate")}
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor={`${id}-expectedDate`}
                className="text-sm font-medium"
              >
                Expected by
              </label>
              <Input
                {...field("expectedDate")}
                type="date"
                min={header.orderDate}
                value={header.expectedDate}
                onChange={(e) => edit({ expectedDate: e.target.value })}
              />
              {fieldError("expectedDate") ?? (
                <p className="text-sm text-muted-foreground">Optional.</p>
              )}
            </div>
          </div>
        </section>

        <section className={section} aria-labelledby={`${id}-items`}>
          <h2 id={`${id}-items`} className="font-semibold">
            Items
          </h2>
          {lines.length > 0 && (
            <LineItemsEditor
              lines={lines}
              amounts={preview.lineAmounts}
              currency={header.currency}
              taxRates={props.taxRates}
              units={props.units}
              example={props.lineExample}
              errors={errors}
              onChange={changeLine}
              onMove={moveLine}
              onRemove={removeLine}
              onTouch={() => undefined}
            />
          )}
          {errors.lines && (
            <p className="text-sm text-destructive">{errors.lines}</p>
          )}
          <div>
            <Button type="button" variant="outline" onClick={addLine}>
              <PlusIcon aria-hidden="true" />
              Add a line
            </Button>
          </div>
          <dl className="ml-auto grid w-full gap-1.5 text-sm sm:max-w-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{preview.subtotal}</dd>
            </div>
            {preview.discount && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Discounts</dt>
                <dd className="tabular-nums">{preview.discount}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums">{preview.tax}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{preview.total}</dd>
            </div>
          </dl>
        </section>

        <section className={section} aria-labelledby={`${id}-more`}>
          <h2 id={`${id}-more`} className="font-semibold">
            Notes and terms
          </h2>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-notes`} className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              {...field("notes")}
              rows={3}
              maxLength={PO_LIMITS.notes}
              placeholder={eg("Deliver to the back door.")}
              value={header.notes}
              onChange={(e) => edit({ notes: e.target.value })}
            />
            {fieldError("notes")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-terms`} className="text-sm font-medium">
              Terms
            </label>
            <Textarea
              {...field("terms")}
              rows={3}
              maxLength={PO_LIMITS.terms}
              placeholder={eg("Payment within 30 days of delivery.")}
              value={header.terms}
              onChange={(e) => edit({ terms: e.target.value })}
            />
            {fieldError("terms")}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={busy && pending !== "save"}
            pending={pending === "save"}
            pendingLabel="Saving…"
          >
            Save draft
          </Button>
          <Button type="button" disabled={busy} onClick={onIssueClick}>
            Issue
          </Button>
        </div>
      </form>
      <IssueOrderDialog
        key={supplier?.id ?? "none"}
        open={issuing}
        onOpenChange={setIssuing}
        supplierEmail={supplier?.email ?? null}
        canEmail={props.emailVerified}
        emailExample={props.emailExample}
        pending={pending === "issue"}
        emailError={errors.emailTo ?? null}
        onEmailEdited={() =>
          setErrors((current) => ({ ...current, emailTo: "" }))
        }
        onConfirm={(email) => void onIssue(email)}
      />
    </>
  );
}
