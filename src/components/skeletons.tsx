import type { ReactNode } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Building blocks for loading.tsx. Every page has its own loading file, drawn
 * in the shape of the page it stands in for, so content lands where the
 * skeleton was (DESIGN.md, "Loading"). These blocks mirror the shared
 * components (PageHeader, ListSearch, FormSection, DocumentPaper…); rows that
 * only one list has are drawn in that page's loading.tsx.
 * src/app/loading-states.test.tsx keeps every page covered.
 */

type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";

/** The line box of each text size, so a skeleton line takes the room its text will. */
const LINE_BOX: Record<TextSize, string> = {
  xs: "h-4",
  sm: "h-5",
  base: "h-6",
  lg: "h-7",
  xl: "h-7",
  "2xl": "h-8",
  "3xl": "h-9",
};

/** The bar inside it, about the height of the letters. */
const BAR: Record<TextSize, string> = {
  xs: "h-3",
  sm: "h-3.5",
  base: "h-4",
  lg: "h-5",
  xl: "h-5",
  "2xl": "h-6",
  "3xl": "h-7",
};

/**
 * What every loading.tsx renders: a status region that tells screen readers
 * `label` once, with the bars themselves hidden from them.
 */
export function LoadingScreen({
  label,
  className,
  children,
}: {
  /** What's on its way, e.g. "Loading customers". */
  label: string;
  /** Layout for the skeleton, which sits where the page's own content will. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

/** One line of text: `width` sizes the bar, `className` lays out the line (e.g. `justify-end`). */
export function TextSkeleton({ width, size = "sm", className }: { width: string; size?: TextSize; className?: string }) {
  return (
    <div className={cn("flex items-center", LINE_BOX[size], className)}>
      <Skeleton className={cn("max-w-full", BAR[size], width)} />
    </div>
  );
}

/** A few lines of running text; the last one stops short. */
export function ParagraphSkeleton({ lines = 3, size = "sm" }: { lines?: number; size?: TextSize }) {
  return (
    <div>
      {Array.from({ length: lines }, (_, i) => (
        <TextSkeleton key={i} size={size} width={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

/** A Button; `lg` for Button size="lg" (form submits, sign-in). */
export function ButtonSkeleton({ width, size = "default" }: { width: string; size?: "default" | "lg" }) {
  return <Skeleton className={cn(size === "lg" ? "h-10 pointer-coarse:h-12" : "h-9 pointer-coarse:h-11", width)} />;
}

/** A StatusBadge. */
export function BadgeSkeleton() {
  return <Skeleton className="h-5 w-16 shrink-0 rounded-full" />;
}

/** An input, select or combobox on its own. */
export function InputSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-9 pointer-coarse:h-11", className)} />;
}

/** Varied widths for repeated rows, so a skeleton list doesn't look like a barcode. */
export function vary(widths: readonly string[], index: number): string {
  return widths[index % widths.length] ?? "w-full";
}

/** PageHeader, with BackLink above it when `back`: title, description and actions. */
export function PageHeaderSkeleton({
  back = false,
  title = "w-48",
  description = "w-80",
  badge = false,
  wraps,
  actions = [],
}: {
  back?: boolean;
  /** Width of the title. */
  title?: string;
  /** Width of each line of the description, or false when the page has none. */
  description?: string | string[] | false;
  /** Width of the extra line a long description wraps onto on phones. */
  wraps?: string;
  /** A status badge leads the description (quote and bill pages). */
  badge?: boolean;
  /** Width of each action button, left to right. */
  actions?: string[];
}) {
  const lines = description === false ? [] : Array.isArray(description) ? description : [description];
  return (
    <>
      {back && <TextSkeleton width="w-24" className="mb-3 h-7 pointer-coarse:h-11" />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <TextSkeleton size="2xl" width={title} />
          {lines.length > 0 && (
            <div>
              {lines.map((width, i) => (
                <div key={i} className="flex h-5 items-center gap-2">
                  {badge && i === 0 && <BadgeSkeleton />}
                  <Skeleton className={cn("h-3.5 max-w-full", width)} />
                </div>
              ))}
              {wraps && (
                <div className="flex h-5 items-center sm:hidden">
                  <Skeleton className={cn("h-3.5 max-w-full", wraps)} />
                </div>
              )}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions.map((width, i) => (
              <ButtonSkeleton key={i} width={width} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** ListSearch: the search box above a list. */
export function ListSearchSkeleton() {
  return <InputSkeleton className="w-full sm:max-w-sm" />;
}

/** ListViews: tabs between views of one list, one width per tab. */
export function ListViewsSkeleton({ views }: { views: string[] }) {
  return (
    <div className="flex gap-1 overflow-hidden">
      {views.map((width, i) => (
        <Skeleton key={i} className={cn("h-8 shrink-0 pointer-coarse:h-11", width)} />
      ))}
    </div>
  );
}

/** The white list sheet, each row drawn by `row` in the list's own shape. */
export function ListSkeleton({
  rows = 6,
  row,
  className,
}: {
  rows?: number;
  row: (index: number) => ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className,
      )}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>{row(i)}</div>
      ))}
    </div>
  );
}

/**
 * How a field sits in a two-column form: one column, both, or a textarea
 * across both; " hint" adds the line of help under it.
 */
export type FieldShape = `${"half" | "wide" | "textarea"}${"" | " hint"}`;

/** A labelled control (FormField): the label, the input or textarea, then its hint. */
export function FieldSkeleton({ shape = "half" }: { shape?: FieldShape }) {
  const [kind, hint] = shape.split(" ");
  return (
    <div className={cn("grid content-start gap-2", kind !== "half" && "sm:col-span-2")}>
      <TextSkeleton width="w-24" />
      {kind === "textarea" ? <Skeleton className="h-20" /> : <InputSkeleton />}
      {hint && <TextSkeleton width="w-56" />}
    </div>
  );
}

/** A white section sheet's heading band (FormSection, NumberingForm, LogoUploader…). */
export function SectionHeadSkeleton({ title = "w-36", description = "w-64" }: { title?: string; description?: string }) {
  return (
    <div className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
      <TextSkeleton size="base" width={title} />
      <TextSkeleton width={description} />
    </div>
  );
}

/** FormSection: the heading band, then fields two to a row on wide screens. */
export function FormSectionSkeleton({ fields }: { fields: FieldShape[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <SectionHeadSkeleton />
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
        {fields.map((shape, i) => (
          <FieldSkeleton key={i} shape={shape} />
        ))}
      </div>
    </div>
  );
}

/** A record or settings form: its sections, then the save button on the right. */
export function FormSkeleton({ sections }: { sections: FieldShape[][] }) {
  return (
    <div className="grid gap-8">
      {sections.map((fields, i) => (
        <FormSectionSkeleton key={i} fields={fields} />
      ))}
      <div className="flex justify-end">
        <ButtonSkeleton size="lg" width="w-full sm:w-36" />
      </div>
    </div>
  );
}

/** A white card with a heading, a few lines of text and a button (account and team pages). */
export function CardSkeleton({
  title = "w-40",
  lines = 2,
  action,
  className,
}: {
  title?: string;
  lines?: number;
  /** Width of its button, if it has one. */
  action?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6", className)}>
      <TextSkeleton size="base" width={title} />
      {lines > 0 && <ParagraphSkeleton lines={lines} />}
      {action && <ButtonSkeleton width={action} />}
    </div>
  );
}

/** DocumentPaper: letterhead and title, who it's for, the lines, then the totals. */
export function DocumentPaperSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <TextSkeleton size="base" width="w-40" />
          <TextSkeleton width="w-52" />
          <TextSkeleton width="w-36" />
        </div>
        <div className="grid gap-1">
          <TextSkeleton size="xl" width="w-32" className="sm:justify-end" />
          <TextSkeleton width="w-24" className="sm:justify-end" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-[1fr_auto]">
        <div className="grid content-start gap-0.5">
          <TextSkeleton size="xs" width="w-14" />
          <TextSkeleton width="w-40" />
          <TextSkeleton width="w-48" />
        </div>
        <div className="grid grid-cols-[auto_auto] content-start gap-x-4 gap-y-1">
          {["w-16", "w-20", "w-20", "w-24", "w-14", "w-20"].map((width, i) => (
            <TextSkeleton key={i} width={width} />
          ))}
        </div>
      </div>
      <div className="mt-8">
        <div className="flex justify-between gap-4 border-b border-border-strong py-2">
          <TextSkeleton size="xs" width="w-20" />
          <TextSkeleton size="xs" width="w-14" />
        </div>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 border-b border-border py-3">
            <div className="grid gap-0.5">
              <TextSkeleton width={vary(["w-48", "w-40", "w-56"], i)} />
              <TextSkeleton width={vary(["w-24", "w-32", "w-20"], i)} />
            </div>
            <TextSkeleton width="w-20" />
          </div>
        ))}
      </div>
      <div className="mt-4 ml-auto grid w-full max-w-72 gap-1.5">
        {["w-16", "w-24"].map((width, i) => (
          <div key={i} className="flex justify-between gap-6">
            <TextSkeleton width={width} />
            <TextSkeleton width="w-20" />
          </div>
        ))}
        <div className="flex justify-between gap-6 border-t border-border pt-1.5">
          <TextSkeleton size="base" width="w-12" />
          <TextSkeleton size="base" width="w-24" />
        </div>
      </div>
    </div>
  );
}

/** AcknowledgementPaper (a payment's receipt): from and to, the details, the amount. */
export function AcknowledgementPaperSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-0.5">
          <TextSkeleton size="xs" width="w-10" />
          <TextSkeleton size="base" width="w-40" />
          <TextSkeleton width="w-48" />
        </div>
        <div className="grid gap-1">
          <TextSkeleton size="xl" width="w-48" className="sm:justify-end" />
          <TextSkeleton width="w-24" className="sm:justify-end" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="grid content-start gap-0.5">
          <TextSkeleton size="xs" width="w-24" />
          <TextSkeleton size="base" width="w-36" />
          <TextSkeleton width="w-44" />
        </div>
        <div className="grid content-start gap-1">
          {["w-20", "w-28", "w-24"].map((width, i) => (
            <div key={i} className="flex justify-between gap-4">
              <TextSkeleton width={width} />
              <TextSkeleton width="w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <TextSkeleton width="w-28" />
        <TextSkeleton size="2xl" width="w-32" />
      </div>
    </div>
  );
}

/** DocumentEditor: customer, lines and details, with the live preview beside them on wide screens. */
export function DocumentEditorSkeleton({ lines = 0 }: { lines?: number }) {
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TextSkeleton width="w-40" />
          <div className="flex flex-wrap gap-2">
            <ButtonSkeleton width="w-28" />
            <ButtonSkeleton width="w-20" />
          </div>
        </div>
        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <TextSkeleton size="base" width="w-20" />
          <InputSkeleton />
        </div>
        <div className="grid gap-4">
          <TextSkeleton size="base" width="w-14" />
          <FieldSkeleton />
          {lines > 0 && (
            <div className="grid gap-3">
              {Array.from({ length: lines }, (_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
                  <div className="flex items-start gap-2">
                    <Skeleton className="mt-2 size-6 shrink-0 rounded-full" />
                    <InputSkeleton className="flex-1" />
                    <Skeleton className="size-9 shrink-0 pointer-coarse:size-11" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:ml-8 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_minmax(0,1fr)]">
                    {["w-8", "w-10", "w-12", "w-10"].map((width, j) => (
                      <div key={j} className="grid gap-1">
                        <TextSkeleton size="xs" width={width} />
                        <InputSkeleton />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <ButtonSkeleton width="w-32" />
          </div>
        </div>
        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <TextSkeleton size="base" width="w-16" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton shape="wide" />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton shape="textarea" />
            <FieldSkeleton shape="textarea" />
          </div>
        </div>
      </div>
      <div className="hidden lg:block">
        <DocumentPaperSkeleton lines={Math.max(lines, 1)} />
      </div>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <TextSkeleton size="base" width="w-32" />
        <ButtonSkeleton width="w-24" />
      </div>
    </div>
  );
}

/** Inside AuthShell's card: AuthHeading, then the form and its submit button. */
export function AuthFormSkeleton({
  title = "w-56",
  description = 0,
  fields = 0,
  checkbox = false,
  footer = false,
}: {
  title?: string;
  /** Lines of description under the heading. */
  description?: number;
  fields?: number;
  /** An agreement checkbox above the button. */
  checkbox?: boolean;
  /** The line of text or link under the button. */
  footer?: boolean;
}) {
  return (
    <>
      <div className="mb-6 grid gap-1.5">
        <TextSkeleton size="xl" width={title} />
        {description > 0 && <ParagraphSkeleton lines={description} />}
      </div>
      <div className="grid gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <FieldSkeleton key={i} />
        ))}
        {checkbox && (
          <div className="flex items-start gap-2.5">
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
            <div className="flex-1">
              <ParagraphSkeleton lines={2} />
            </div>
          </div>
        )}
        <ButtonSkeleton size="lg" width="w-full" />
        {footer && <TextSkeleton width="w-48" className="justify-center" />}
      </div>
    </>
  );
}

/** LegalDocument: title, date and intro, then sections of running text. */
export function LegalDocumentSkeleton({ sections = 6 }: { sections?: number }) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <TextSkeleton size="2xl" width="w-56" />
        <TextSkeleton width="w-44" />
        <ParagraphSkeleton size="base" lines={3} />
      </div>
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="grid gap-3">
          <TextSkeleton size="lg" width={vary(["w-40", "w-52", "w-36", "w-48"], i)} />
          <ParagraphSkeleton size="base" lines={[4, 3, 5][i % 3] ?? 4} />
        </div>
      ))}
    </div>
  );
}

/** What a customer sees at a shared link (q/[token], i/[token]): the sender, the document, the footer. */
export function PortalDocumentSkeleton({ label, balance = false }: { label: string; balance?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <LoadingScreen label={label}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <TextSkeleton width="w-52" />
          <div className="flex items-center gap-3">
            <BadgeSkeleton />
            <TextSkeleton width="w-24" />
          </div>
        </div>
        {balance && (
          <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
            <div>
              <TextSkeleton width="w-24" />
              <TextSkeleton size="3xl" width="w-40" />
              <TextSkeleton width="w-28" className="mt-1" />
            </div>
            <div className="grid content-start">
              <TextSkeleton width="w-24" />
              <ParagraphSkeleton lines={2} />
            </div>
          </div>
        )}
        <DocumentPaperSkeleton />
        <TextSkeleton size="xs" width="w-28" className="mt-10 justify-center" />
        <TextSkeleton size="xs" width="w-32" className="mt-2 justify-center" />
      </LoadingScreen>
    </main>
  );
}
