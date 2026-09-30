export { getOutboxStats, type OutboxStats } from "./application/outbox-stats";
export { flushOutboxAfterResponse } from "./application/flush";
export { dispatchOutbox, type DispatchResult, enqueueEmail } from "./application/outbox";
export { passwordResetEmail, verifyEmailEmail } from "./domain/auth-emails";
export { type DocumentLinkEmailInput, documentLinkEmail } from "./domain/document-emails";
export { type QuoteDecisionEmailInput, quoteDecisionEmail } from "./domain/decision-emails";
export type { EmailMessage, EmailSender } from "./domain/email";
export { createMemorySender } from "./infra/senders";
export { getEmailSender, sendEmail, setEmailSender } from "./infra/transport";
