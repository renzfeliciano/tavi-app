import type { EmailMessage, EmailSender } from "./domain/email";
import { consoleSender } from "./infra/senders";

export { passwordResetEmail, verifyEmailEmail } from "./domain/auth-emails";
export type { EmailMessage, EmailSender } from "./domain/email";
export { createMemorySender } from "./infra/senders";

let activeSender: EmailSender = consoleSender;

/** Swap the transport (tests, and the real provider in Phase 0.5). */
export function setEmailSender(sender: EmailSender): void {
  activeSender = sender;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await activeSender.send(message);
}
