import type { EmailMessage, EmailSender } from "../domain/email";
import { createResendSender } from "./resend-sender";
import { consoleSender } from "./senders";
import { createSmtpSender } from "./smtp-sender";
import { chooseEmailTransport } from "./transport-selection";

// The active email transport, chosen from the environment (see
// chooseEmailTransport). Tests swap in a memory sender with setEmailSender().
function defaultSender(): EmailSender {
  const env = process.env;
  const transport = chooseEmailTransport({
    RESEND_API_KEY: env.RESEND_API_KEY,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
    EMAIL_FROM: env.EMAIL_FROM,
  });
  switch (transport) {
    case "resend":
      return createResendSender({ apiKey: env.RESEND_API_KEY!, from: env.EMAIL_FROM! });
    case "smtp":
      return createSmtpSender({
        host: env.SMTP_HOST || "smtp.gmail.com",
        port: Number(env.SMTP_PORT || 465),
        user: env.SMTP_USER!,
        password: env.SMTP_PASSWORD!,
        from: env.EMAIL_FROM!,
      });
    case "console":
      return consoleSender;
  }
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
