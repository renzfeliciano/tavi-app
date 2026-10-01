"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  CircleAlertIcon,
  CloudOffIcon,
  EyeIcon,
  LoaderCircleIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/async-combobox";
import { DocumentPaper } from "@/components/document/document-paper";
import { buildDocumentView, type DocumentView, type DocumentViewLineInput } from "@/components/document/document-view";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CurrencyOption } from "@/config/currencies";
import {
  blankLine,
  calculateDocument,
  DOCUMENT_LIMITS,
  parseDocumentLines,
  type RawLine,
  type TaxMode,
} from "@/modules/documents/client";
import { parseInvoiceDraft } from "@/modules/invoices/client";
import { parseQuoteDraft } from "@/modules/quotes/client";
import { formatAmountForInput, formatMoney } from "@/shared/money";
import { CustomerForm, type CustomerFormCopy, EMPTY_CUSTOMER } from "../customers/_components/customer-form";
import { customerForDocumentAction, searchCustomersAction, searchLineSourcesAction } from "./actions";
import type {
  CustomerChoice,
  Delivery,
  DocumentEditorActions,
  DocumentKind,
  EditorCustomer,
  LineSourceChoice,
  TaxRateChoice,
} from "./editor-types";
import { type EditorLine, LineItemsEditor } from "./line-items-editor";
import { type DeliveryOutcome, SendDocumentDialog } from "./send-document-dialog";
import { type AutosaveStatus, useAutosave } from "./use-autosave";

export type DocumentEditorState = {
  customerId: string;
  currency: string;
  issueDate: string;
  /** The second date: valid until (quotes) or due (invoices). */
  endDate: string;
  notes: string;
  terms: string;
  lines: EditorLine[];
};

/** What differs between the quote and invoice editors. */
const KINDS = {
  quote: { noun: "quote", path: "/quotes", endField: "validUntil", endLabel: "Valid until", parse: parseQuoteDraft },
  invoice: { noun: "invoice", path: "/invoices", endField: "dueDate", endLabel: "Due date", parse: parseInvoiceDraft },
} as const;

type DocumentEditorProps = {
  kind: DocumentKind;
  /**
   * "draft" autosaves; "issued" edits a sent document (D7): customer and
   * currency fixed, nothing saved until "Save changes" is confirmed.
   */
  mode?: "draft" | "issued";
  /** The saved draft, or null for a new one (created on the first change). */
  documentId: string | null;
  /** The draft's own server actions (save, delete, send). */
  actions: DocumentEditorActions;
  initial: DocumentEditorState;
  initialCustomer: EditorCustomer | null;
  locale: string;
  taxMode: TaxMode;
  /** The market's name for the document, e.g. "Quotation" or "Billing statement". */
  title: string;
  number: string | null;
  revision: number;
  business: DocumentView["business"];
  currencies: CurrencyOption[];
  taxRates: TaxRateChoice[];
  defaultTaxRateId: string | null;
  /** How to pay (invoices), from the business profile; null for quotes. */
  paymentInstructions: string | null;
  /** Bold notice for supplementary documents (PH: not valid for claim of input tax), or null. */
  notice: string | null;
  /** The market's usual unit for new free-text lines. */
  defaultUnit: string;
  customerCopy: CustomerFormCopy;
  /** Where people paste a link, e.g. "Messenger or Viber". */
  shareChannels: string;
  /** Sending needs the sender's own email confirmed. */
  emailVerified: boolean;
};

/** An editor row without its React key: what the server and the parser read. */
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

let keySeed = 0;
const newKey = () => `new-${Date.now().toString(36)}-${(keySeed++).toString(36)}`;

function StatusLine({ status }: { status: AutosaveStatus }) {
  const base = "flex items-center gap-1.5 text-sm";
  switch (status.kind) {
    case "saving":
      return (
        <p role="status" className={`${base} text-muted-foreground`}>
          <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" /> Saving…
        </p>
      );
    case "saved":
      return (
        <p role="status" className={`${base} text-muted-foreground`}>
          <CheckIcon aria-hidden="true" className="size-3.5 text-success" /> Saved
        </p>
      );
    case "blocked":
      return (
        <p role="status" className={`${base} text-warning-strong`}>
          <CircleAlertIcon aria-hidden="true" className="size-3.5" /> {status.message}
        </p>
      );
    case "failed":
      return (
        <p role="status" className={`${base} text-danger-strong`}>
          <CloudOffIcon aria-hidden="true" className="size-3.5" /> {status.message}
        </p>
      );
    case "pending":
      return (
        <p role="status" className={`${base} text-muted-foreground`}>
          Unsaved changes
        </p>
      );
    default:
      return <p role="status" className={base} />;
  }
}

export function DocumentEditor(props: DocumentEditorProps) {
  const { locale, taxMode, taxRates, actions } = props;
  const kind = KINDS[props.kind];
  const issued = props.mode === "issued";
  const [confirmSave, setConfirmSave] = useState(false);
  const [savingIssued, setSavingIssued] = useState(false);
  const router = useRouter();
  const [documentId, setDocumentId] = useState(props.documentId);
  // The saved draft's id, updated the moment the first save returns. A save
  // queued behind that first one runs before React re-renders, so it must read
  // this ref (not state), or it would create a second draft.
  const idRef = useRef(props.documentId);
  const [state, setState] = useState(props.initial);
  const [customer, setCustomer] = useState(props.initialCustomer);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const update = useCallback((patch: Partial<DocumentEditorState>, clearErrorsFor: string[] = []) => {
    setState((s) => ({ ...s, ...patch }));
    setDirty(true);
    if (clearErrorsFor.length > 0) {
      setServerErrors((errors) => {
        const next = { ...errors };
        for (const key of clearErrorsFor) delete next[key];
        return next;
      });
    }
  }, []);

  const touch = useCallback((key: string) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key))), []);

  // What the server receives: the editor's state minus row keys, with the
  // second date under the document's own name (validUntil / dueDate).
  const payload = useMemo(() => {
    const { endDate, ...rest } = state;
    return { ...rest, [kind.endField]: endDate, lines: state.lines.map(toRawLine) };
  }, [state, kind.endField]);
  const clientErrors = useMemo(() => {
    const parsed = kind.parse(payload, { locale });
    return parsed.ok ? {} : parsed.errors;
  }, [payload, locale, kind]);

  // The preview shows every line that can already be read, even while others are unfinished.
  const ratesById = useMemo(() => new Map(taxRates.map((r) => [r.id, r])), [taxRates]);
  const preview = useMemo(() => {
    const rows: { key: string; line: DocumentViewLineInput }[] = [];
    for (const editorLine of state.lines) {
      const key = editorLine.key;
      const result = parseDocumentLines([toRawLine(editorLine)], { currency: state.currency, locale });
      const parsedLine = result.ok ? result.lines[0] : undefined;
      if (!parsedLine) continue;
      const rate = parsedLine.taxRateId ? ratesById.get(parsedLine.taxRateId) : undefined;
      rows.push({
        key,
        line: {
          description: parsedLine.description,
          quantity: parsedLine.quantity,
          unitLabel: parsedLine.unitLabel,
          unitPriceMinor: parsedLine.unitPriceMinor,
          discount: parsedLine.discount,
          tax: rate ? { name: rate.name, rateBps: rate.rateBps } : null,
        },
      });
    }
    let amounts;
    try {
      amounts = calculateDocument({ taxMode, lines: rows.map((r) => ({ ...r.line })) });
    } catch {
      amounts = calculateDocument({ taxMode, lines: [] });
    }
    const lineAmounts: Record<string, string> = {};
    rows.forEach((row, i) => {
      const a = amounts.lines[i];
      if (a) lineAmounts[row.key] = formatMoney(a.netMinor, state.currency, { locale });
    });
    const view = buildDocumentView({
      title: props.title,
      number: props.number,
      revision: props.revision,
      business: props.business,
      customer: customer?.party ?? null,
      currency: state.currency,
      locale,
      taxMode,
      dates: [
        { label: "Date", date: state.issueDate },
        { label: kind.endLabel, date: state.endDate },
      ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
      lines: rows.map((r) => r.line),
      amounts,
      notes: state.notes.trim() || null,
      terms: state.terms.trim() || null,
      paymentInstructions: props.paymentInstructions,
      notice: props.notice,
    });
    return { view, lineAmounts, total: formatMoney(amounts.totalMinor, state.currency, { locale }) };
  }, [state, customer, locale, taxMode, ratesById, kind.endLabel, props.title, props.number, props.revision, props.business, props.notice, props.paymentInstructions]);

  // Show a field's problem once the person has left it, or once the server reported it.
  const visibleErrors = useMemo(() => {
    const shown: Record<string, string> = { ...serverErrors };
    for (const [key, message] of Object.entries(clientErrors)) if (touched.has(key)) shown[key] = message;
    return shown;
  }, [clientErrors, serverErrors, touched]);

  const validate = useCallback(
    (value: typeof payload) => {
      const result = kind.parse(value, { locale });
      if (result.ok) return null;
      const first = Object.keys(result.errors)[0] ?? "";
      const line = /^lines\.(\d+)\./.exec(first);
      return line ? `Not saved yet: finish line ${Number(line[1]) + 1}.` : "Not saved yet: fix the highlighted fields.";
    },
    [locale, kind],
  );

  const save = useCallback(
    async (value: typeof payload) => {
      const response = await actions.saveDraft(idRef.current, value);
      if (response.ok) {
        setServerErrors({});
        setFormError(null);
        if (!idRef.current) {
          idRef.current = response.id;
          setDocumentId(response.id);
          // Keep editing in place; the address now points at the saved draft.
          window.history.replaceState(null, "", `${kind.path}/${response.id}`);
        }
        return { ok: true as const };
      }
      if ("errors" in response) {
        setServerErrors(response.errors);
        return { ok: false as const, message: "Not saved: fix the highlighted fields.", retry: false };
      }
      setFormError(response.error);
      return { ok: false as const, message: response.error, retry: false };
    },
    [actions, kind.path],
  );

  const { status } = useAutosave({ value: payload, enabled: dirty && !issued, validate, save });

  // Issued documents save once, on purpose: each save is a new revision the customer sees.
  const saveIssued = async () => {
    if (!documentId || !actions.saveIssued) return;
    setSavingIssued(true);
    const result = await actions.saveIssued(documentId, payload);
    setSavingIssued(false);
    setConfirmSave(false);
    if (result.ok) {
      setDirty(false);
      toast.success(`${props.title} ${props.number ?? ""} updated.`.replace("  ", " "), {
        description: "The customer's link shows the new version.",
      });
      router.push(`${kind.path}/${documentId}`);
      router.refresh();
      return;
    }
    if ("errors" in result) {
      setServerErrors(result.errors);
      toast.error("Not saved: fix the highlighted parts first.");
      return;
    }
    setFormError(result.error);
    toast.error(result.error);
  };

  // Saving is quiet when it works (the status line); a failure also gets a toast (one at a time).
  useEffect(() => {
    if (status.kind === "failed") toast.error(status.message, { id: "document-autosave" });
    if (status.kind === "saved") toast.dismiss("document-autosave");
  }, [status]);

  const changeLine = (key: string, patch: Partial<RawLine>) => {
    const index = state.lines.findIndex((l) => l.key === key);
    update(
      { lines: state.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) },
      Object.keys(patch).map((field) => `lines.${index}.${field}`),
    );
  };
  const moveLine = (key: string, direction: -1 | 1) => {
    const lines = [...state.lines];
    const from = lines.findIndex((l) => l.key === key);
    const to = from + direction;
    const [line] = lines.splice(from, 1);
    if (!line || to < 0 || to > lines.length) return;
    lines.splice(to, 0, line);
    update({ lines });
    setServerErrors({});
  };
  const removeLine = (key: string) => {
    update({ lines: state.lines.filter((l) => l.key !== key) });
    setServerErrors({});
    setTouched(new Set());
  };
  const newLine = (): EditorLine => ({
    ...blankLine(),
    key: newKey(),
    quantity: "1",
    unitLabel: props.defaultUnit,
    taxRateId: props.defaultTaxRateId ?? "",
  });
  const addLine = () => update({ lines: [...state.lines, newLine()] });

  const addFromCatalog = (source: LineSourceChoice | null) => {
    if (!source) return;
    const samePrice = source.currency === state.currency;
    const line: EditorLine = {
      ...newLine(),
      description: source.description ? `${source.name}\n${source.description}` : source.name,
      unitLabel: source.unitLabel,
      unitPrice: samePrice ? formatAmountForInput(source.unitPriceMinor, source.currency, locale) : "",
      taxRateId: source.taxRateId ?? "",
      sourceKind: source.kind,
      sourceId: source.id,
    };
    // Fill a trailing blank line rather than leaving it behind.
    const last = state.lines.at(-1);
    const lines =
      last && last.description.trim() === "" && last.unitPrice.trim() === ""
        ? [...state.lines.slice(0, -1), line]
        : [...state.lines, line];
    update({ lines });
    if (!samePrice) toast.info(`${source.name} is priced in ${source.currency}. Enter its ${state.currency} price.`);
  };

  const chooseCustomer = async (choice: CustomerChoice | null) => {
    if (!choice) {
      setCustomer(null);
      update({ customerId: "" }, ["customerId"]);
      return;
    }
    const loaded = await customerForDocumentAction(choice.id);
    if (!loaded) {
      toast.error("That customer no longer exists.");
      return;
    }
    setCustomer(loaded);
    const noPricesYet = state.lines.every((l) => l.unitPrice.trim() === "");
    update(
      { customerId: loaded.id, ...(loaded.currency && noPricesYet ? { currency: loaded.currency } : {}) },
      ["customerId"],
    );
  };

  const deleteDraft = async () => {
    if (!documentId) {
      router.push(kind.path);
      return;
    }
    setDeleting(true);
    const result = await actions.deleteDraft(documentId);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDirty(false);
    toast.success("Draft deleted.");
    router.push(kind.path);
  };

  const send = async (delivery: Delivery): Promise<DeliveryOutcome> => {
    const response = await actions.send(idRef.current, payload, delivery);
    if (response.ok) {
      setDirty(false);
      setSendOpen(false);
      const name = `${props.title} ${response.number}`;
      if (delivery.mode === "email") {
        toast.success(`${name} sent to ${response.emailedTo}.`);
      } else {
        try {
          await navigator.clipboard.writeText(response.url);
          toast.success(`${name} is ready. Link copied.`, { description: `Paste it into ${props.shareChannels}.` });
        } catch {
          // No clipboard access (e.g. permissions): show the link to copy by hand.
          toast.success(`${name} is ready.`, { description: response.url, duration: 20_000 });
        }
      }
      router.push(`${kind.path}/${response.id}`);
      router.refresh();
      return { ok: true };
    }
    if ("errors" in response) {
      if (response.errors.emailTo) return { ok: false, emailError: response.errors.emailTo };
      setServerErrors(response.errors);
      setSendOpen(false);
      toast.error("Not sent yet: fix the highlighted parts first.");
      return { ok: false };
    }
    return { ok: false, error: response.error };
  };

  const headerError = (field: string) => visibleErrors[field];
  const customerChoice: CustomerChoice | null = customer
    ? { id: customer.id, displayName: customer.party.name, detail: customer.party.subtitle }
    : null;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {issued ? (
            <p role="status" className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "No changes yet"}
            </p>
          ) : (
            <StatusLine status={status} />
          )}
          {issued ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => router.push(`${kind.path}/${documentId}`)}>
                Discard changes
              </Button>
              <Button
                type="button"
                disabled={!dirty}
                onClick={() => {
                  const problems = validate(payload);
                  if (problems) {
                    setTouched(new Set(Object.keys(clientErrors)));
                    toast.error(problems);
                    return;
                  }
                  setConfirmSave(true);
                }}
              >
                <CheckIcon aria-hidden="true" />
                Save changes
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon aria-hidden="true" />
                {documentId ? "Delete draft" : "Discard"}
              </Button>
              <Button type="button" onClick={() => setSendOpen(true)}>
                <SendIcon aria-hidden="true" />
                Send
              </Button>
            </div>
          )}
        </div>
        <FormAlert message={formError} />

        <section aria-labelledby="doc-customer" className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 id="doc-customer" className="font-semibold">
            Customer
          </h2>
          <AsyncCombobox<CustomerChoice>
            label="Customer"
            hideLabel
            placeholder="Search your customers"
            value={customerChoice}
            onValueChange={(choice) => void chooseCustomer(choice)}
            disabled={issued}
            search={searchCustomersAction}
            itemKey={(c) => c.id}
            itemLabel={(c) => c.displayName}
            renderItem={(c) => (
              <span className="grid">
                <span className="font-medium">{c.displayName}</span>
                {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
              </span>
            )}
            invalid={Boolean(headerError("customerId"))}
            describedBy={headerError("customerId") ? "customer-error" : undefined}
            footer={
              <button
                type="button"
                onClick={() => setAddCustomerOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-accent pointer-coarse:py-3"
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                Add a new customer
              </button>
            }
          />
          {headerError("customerId") && (
            <p id="customer-error" className="text-sm text-destructive">
              {headerError("customerId")}
            </p>
          )}
        </section>

        <section aria-labelledby="doc-lines" className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="doc-lines" className="font-semibold">
              Items
            </h2>
          </div>
          <AsyncCombobox<LineSourceChoice>
            label="Add from Products & Services"
            placeholder="Search products and services"
            value={null}
            resetAfterSelect
            onValueChange={addFromCatalog}
            search={searchLineSourcesAction}
            itemKey={(s) => s.key}
            itemLabel={(s) => s.name}
            renderItem={(s) => (
              <span className="flex w-full items-start justify-between gap-3">
                <span className="grid min-w-0">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.kind === "service" ? "Service" : "Product"}
                    {s.sku ? ` · ${s.sku}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums">
                  {formatMoney(s.unitPriceMinor, s.currency, { locale })}
                  <span className="block text-muted-foreground">per {s.unitLabel}</span>
                </span>
              </span>
            )}
          />
          {state.lines.length > 0 && (
            <LineItemsEditor
              lines={state.lines}
              amounts={preview.lineAmounts}
              currency={state.currency}
              taxRates={taxRates}
              errors={visibleErrors}
              onChange={changeLine}
              onMove={moveLine}
              onRemove={removeLine}
              onTouch={touch}
            />
          )}
          {visibleErrors.lines && <p className="text-sm text-destructive">{visibleErrors.lines}</p>}
          <div>
            <Button type="button" variant="outline" onClick={addLine}>
              <PlusIcon aria-hidden="true" />
              Add a line
            </Button>
          </div>
        </section>

        <section aria-labelledby="doc-details" className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 id="doc-details" className="font-semibold">
            Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="doc-currency" className="text-sm font-medium">
                Currency
              </label>
              <NativeSelect
                id="doc-currency"
                disabled={issued}
                value={state.currency}
                onChange={(e) => update({ currency: e.target.value }, ["currency"])}
              >
                {props.currencies.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {(
              [
                ["issueDate", "Date"],
                ["endDate", kind.endLabel],
              ] as const
            ).map(([field, label]) => {
              // Errors are keyed by the document's own field name (validUntil / dueDate).
              const errorKey = field === "endDate" ? kind.endField : field;
              return (
              <div key={field} className="grid gap-1.5">
                <label htmlFor={`doc-${field}`} className="text-sm font-medium">
                  {label}
                </label>
                <Input
                  id={`doc-${field}`}
                  type="date"
                  value={state[field]}
                  onChange={(e) => update({ [field]: e.target.value }, [field])}
                  onBlur={() => touch(errorKey)}
                  aria-invalid={headerError(errorKey) ? true : undefined}
                  aria-describedby={headerError(errorKey) ? `doc-${field}-error` : undefined}
                />
                {headerError(errorKey) && (
                  <p id={`doc-${field}-error`} className="text-sm text-destructive">
                    {headerError(errorKey)}
                  </p>
                )}
              </div>
              );
            })}
          </div>
          {(
            [
              ["notes", "Notes", "Shown to the customer, e.g. what's included."],
              ["terms", "Terms", "Payment and warranty terms."],
            ] as const
          ).map(([field, label, hint]) => (
            <div key={field} className="grid gap-1.5">
              <label htmlFor={`doc-${field}`} className="text-sm font-medium">
                {label} <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id={`doc-${field}`}
                value={state[field]}
                onChange={(e) => update({ [field]: e.target.value }, [field])}
                maxLength={DOCUMENT_LIMITS[field]}
                rows={2}
                aria-describedby={`doc-${field}-hint`}
              />
              <p id={`doc-${field}-hint`} className="text-sm text-muted-foreground">
                {headerError(field) ?? hint}
              </p>
            </div>
          ))}
        </section>
      </div>

      <aside aria-label="Preview" className="hidden lg:sticky lg:top-6 lg:block">
        <DocumentPaper view={preview.view} />
      </aside>

      {/* Phones: the total stays in reach, and the preview opens as a sheet. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <p className="text-sm">
          <span className="text-muted-foreground">Total </span>
          <span className="text-base font-semibold tabular-nums">{preview.total}</span>
        </p>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <EyeIcon aria-hidden="true" />
          Preview
        </Button>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Preview</SheetTitle>
            <SheetDescription>What your customer will see.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <DocumentPaper view={preview.view} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Add a new customer</SheetTitle>
            <SheetDescription>{`They're added to your customers and chosen for this ${kind.noun}.`}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CustomerForm
              initialValues={EMPTY_CUSTOMER}
              copy={props.customerCopy}
              onSaved={(saved) => {
                setAddCustomerOpen(false);
                toast.success(`${saved.displayName} added.`);
                void chooseCustomer({ id: saved.id, displayName: saved.displayName, detail: null });
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <SendDocumentDialog
        // Its defaults (email or link, recipient, greeting) follow the chosen customer.
        key={customer?.id ?? "no-customer"}
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={props.title}
        customerName={customer?.party.name ?? null}
        customerEmail={customer?.email ?? null}
        businessName={props.business.name}
        shareChannels={props.shareChannels}
        emailVerified={props.emailVerified}
        onSend={send}
      />

      <Dialog open={confirmSave} onOpenChange={(open) => !savingIssued && setConfirmSave(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Update ${props.title} ${props.number ?? ""}?`.replace(" ?", "?")}</DialogTitle>
            <DialogDescription>
              {`It becomes revision ${props.revision + 1}. The customer's link shows the new version with an "Updated" note, and the change is kept in your activity log.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep editing</DialogClose>
            <Button type="button" pending={savingIssued} pendingLabel="Saving…" onClick={() => void saveIssued()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{documentId ? "Delete this draft?" : `Discard this ${kind.noun}?`}</DialogTitle>
            <DialogDescription>
              {documentId
                ? "The draft and its items are removed. This can't be undone."
                : "Nothing has been saved yet, so there's nothing to keep."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep editing</DialogClose>
            <Button
              type="button"
              variant="destructive"
              pending={deleting}
              pendingLabel="Deleting…"
              onClick={() => void deleteDraft()}
            >
              {documentId ? "Delete draft" : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
