// Browser-safe exports of the payments module (the record-payment form checks as you type).
export { MAX_ACK_RECIPIENTS, parseAckRecipients } from "./domain/ack-recipients";
export { PAYMENT_LIMITS, type PaymentInput, parsePaymentInput, type RawPayment } from "./domain/payment-input";
export {
  parseReceiptInput,
  RECEIPT_KINDS,
  RECEIPT_LIMITS,
  type RawReceipt,
  type ReceiptInput,
  type ReceiptKind,
} from "./domain/receipt-input";
export { type PaymentProof, paymentProofRows, type ProofRow } from "./domain/payment-proof";
export {
  type CertificateInput,
  type CertificateInputResult,
  type CertificateLineInput,
  defaultTaxWithheld,
  LINK_MESSAGES,
  monthNamesOfQuarter,
  parseCertificateInput,
  type Quarter,
  quarterBounds,
  quarterOf,
  type RawCertificate,
  type RawCertificateLine,
  reconcile,
  WITHHOLDING_LIMITS,
  type WithholdingStatus,
  withholdingStatus,
} from "./domain/withholding";
