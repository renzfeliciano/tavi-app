import {
  BanIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotDashedIcon,
  CircleXIcon,
  EyeIcon,
  FileXIcon,
  HourglassIcon,
  type LucideIcon,
  PencilLineIcon,
  SendIcon,
} from "lucide-react";
import type { InvoiceStatus } from "@/modules/invoices";
import type { QuoteStatus } from "@/modules/quotes";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type StatusPresentation = {
  label: string;
  /** Plain-language meaning, used for tooltips and screen-reader context. */
  description: string;
  tone: StatusTone;
  icon: LucideIcon;
};

// One vocabulary for the whole product: app, portals, PDFs and emails all use
// these labels (§35 "consistent terminology").
export const quoteStatusPresentation: Record<QuoteStatus, StatusPresentation> =
  {
    DRAFT: {
      label: "Draft",
      description: "Not sent yet. Only your team can see it.",
      tone: "neutral",
      icon: PencilLineIcon,
    },
    SENT: {
      label: "Sent",
      description: "Sent to the customer. They haven't opened it yet.",
      tone: "info",
      icon: SendIcon,
    },
    VIEWED: {
      label: "Viewed",
      description: "The customer has opened the quote.",
      tone: "info",
      icon: EyeIcon,
    },
    APPROVED: {
      label: "Approved",
      description: "The customer approved this quote.",
      tone: "success",
      icon: CircleCheckIcon,
    },
    REJECTED: {
      label: "Declined",
      description: "The customer declined this quote.",
      tone: "danger",
      icon: CircleXIcon,
    },
    EXPIRED: {
      label: "Expired",
      description: "The valid-until date passed before the customer answered.",
      tone: "muted",
      icon: HourglassIcon,
    },
    CANCELLED: {
      label: "Cancelled",
      description: "Withdrawn by your team. It can no longer be approved.",
      tone: "muted",
      icon: BanIcon,
    },
  };

export const invoiceStatusPresentation: Record<
  InvoiceStatus,
  StatusPresentation
> = {
  DRAFT: {
    label: "Draft",
    description: "Not issued yet. Only your team can see it.",
    tone: "neutral",
    icon: PencilLineIcon,
  },
  SENT: {
    label: "Unpaid",
    description: "Issued and waiting for payment.",
    tone: "info",
    icon: SendIcon,
  },
  PARTIALLY_PAID: {
    label: "Partially paid",
    description: "Some payments received; a balance is still due.",
    tone: "warning",
    icon: CircleDotDashedIcon,
  },
  PAID: {
    label: "Paid",
    description: "Paid in full.",
    tone: "success",
    icon: CircleCheckIcon,
  },
  OVERDUE: {
    label: "Overdue",
    description: "Past its due date with a balance still owed.",
    tone: "danger",
    icon: CircleAlertIcon,
  },
  VOID: {
    label: "Void",
    description: "Issued in error. Excluded from all totals.",
    tone: "muted",
    icon: FileXIcon,
  },
  CANCELLED: {
    label: "Cancelled",
    description: "The sale was called off. Kept for your records.",
    tone: "muted",
    icon: BanIcon,
  },
};
