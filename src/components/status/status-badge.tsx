import type { InvoiceStatus } from "@/modules/invoices";
import type { QuoteStatus } from "@/modules/quotes";
import { cn } from "@/lib/utils";
import {
  invoiceStatusPresentation,
  quoteStatusPresentation,
  type StatusTone,
} from "./presentation";

type StatusBadgeProps = (
  | { kind: "quote"; status: QuoteStatus }
  | { kind: "invoice"; status: InvoiceStatus }
) & { className?: string };

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border-strong bg-secondary text-ink-subtle",
  info: "border-info/25 bg-info-subtle text-info-strong",
  success: "border-success/25 bg-success-subtle text-success-strong",
  warning: "border-warning/45 bg-warning-subtle text-warning-strong",
  danger: "border-danger/25 bg-danger-subtle text-danger-strong",
  muted: "border-border bg-transparent text-muted-foreground",
};

/** Document status as icon + label. Colour is never the only signal (§34). */
export function StatusBadge(props: StatusBadgeProps) {
  const presentation =
    props.kind === "quote"
      ? quoteStatusPresentation[props.status]
      : invoiceStatusPresentation[props.status];
  const Icon = presentation.icon;

  return (
    <span
      title={presentation.description}
      data-tone={presentation.tone}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap transition-colors duration-(--duration-normal)",
        TONE_CLASSES[presentation.tone],
        props.className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {presentation.label}
    </span>
  );
}
