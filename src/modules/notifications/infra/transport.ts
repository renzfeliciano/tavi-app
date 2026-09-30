import type { EmailMessage, EmailSender } from "../domain/email";
import { createResendSender } from "./resend-sender";
import { consoleSender } from "./senders";

// The active email transport: Resend when RESEND_API_KEY and EMAIL_FROM are
// set, otherwise the console sender (which refuses to run in production).
// Tests swap in a memory sender with setEmailSender().
function defaultSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? createResendSender({ apiKey, from }) : consoleSender;
}

let activeSender: EmailSender = defaultSender();

export function setEmailSender(sender: EmailSender): void {
  activeSender = sender;
}

export function getEmailSender(): EmailSender {
  return activeSender;
}

/** Sends immediately. For auth emails; business emails go through the outbox. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await activeSender.send(message);
}
