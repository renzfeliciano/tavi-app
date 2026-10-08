// Browser-safe exports of the invoices module (the editor parses drafts as you type).
export { type InvoiceDraft, type InvoiceDraftResult, parseInvoiceDraft, type RawInvoiceDraft } from "./domain/invoice-draft";
export { INVOICE_STATUSES, type InvoiceStatus } from "./domain/status";
export { EDITABLE_INVOICE_STATUSES, INVOICE_EVENTS, type InvoiceEvent, transitionInvoice } from "./domain/transitions";
export { INVOICE_REASON_MAX, issuedEditProblems, parseInvoiceReason } from "./domain/corrections";
export { isPayable } from "./domain/issuing";
export { canEditIssued, REGISTERED_INVOICE_LOCKED } from "./domain/corrections";
export { formatSerial, INVOICE_REGISTRATION_LIMITS, invoiceTitle, registrationFooter } from "./domain/registration";
export { type SalesBreakdown, salesBreakdown, salesBreakdownRows } from "./domain/sales-breakdown";
export { buyerTaxIdReminder } from "./domain/registration";
export {
  EMPTY_QUALIFIED_DISCOUNT,
  parseQualifiedDiscount,
  QUALIFIED_DISCOUNT_FIELDS,
  QUALIFIED_DISCOUNT_LIMITS,
  type QualifiedDiscountConfig,
  qualifiedDiscountInput,
  qualifiedDiscountRows,
  type QualifiedDiscountSnapshot,
  type RawQualifiedDiscount,
  toRawQualifiedDiscount,
} from "./domain/qualified-discount";
