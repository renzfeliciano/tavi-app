export { getOutboxStats, type OutboxStats } from "./application/outbox-stats";
export { flushOutboxAfterResponse } from "./application/flush";
export { dispatchOutbox, type DispatchResult, enqueueEmail } from "./application/outbox";
export { emailLimitReached } from "./application/document-email-limit";
export {
  DOCUMENT_EMAIL_LIMIT,
  documentEmailLimitMessage,
  type EmailLimitReason,
  GLOBAL_EMAIL_LIMIT,
  PERSON_EMAIL_LIMIT,
} from "./domain/document-email-limit";
export { passwordResetEmail, verifyEmailEmail } from "./domain/auth-emails";
export { type DocumentLinkEmailInput, documentLinkEmail } from "./domain/document-emails";
export { type QuoteDecisionEmailInput, quoteDecisionEmail } from "./domain/decision-emails";
export { type PaymentAcknowledgementEmailInput, paymentAcknowledgementEmail } from "./domain/payment-emails";
export { type ReceiptEmailInput, receiptEmail } from "./domain/receipt-emails";
export { type PurchaseOrderEmailInput, purchaseOrderEmail } from "./domain/purchase-order-emails";
export { type TeamInvitationEmailInput, teamInvitationEmail } from "./domain/team-emails";
export type { EmailMessage, EmailSender } from "./domain/email";
export { createMemorySender } from "./infra/senders";
export { getEmailSender, sendEmail, setEmailSender } from "./infra/transport";
