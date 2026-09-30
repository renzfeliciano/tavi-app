import nodemailer from "nodemailer";
import type { EmailMessage, EmailSender } from "../domain/email";

type SmtpTransport = { sendMail(options: Record<string, unknown>): Promise<unknown> };

type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  /** For Gmail: a 16-character App Password, never the account password. */
  password: string;
  /** Gmail sends as the signed-in account, so use that address here. */
  from: string;
  createTransport?: (options: Record<string, unknown>) => SmtpTransport;
};

/**
 * SMTP sender, used with Gmail on the free tier (decision D11). Port 465 is
 * TLS from the start; 587 upgrades with STARTTLS. Errors keep only the SMTP
 * response code, because server messages can echo credentials.
 */
export function createSmtpSender({
  host,
  port,
  user,
  password,
  from,
  createTransport = (o) => nodemailer.createTransport(o) as unknown as SmtpTransport,
}: SmtpOptions): EmailSender {
  let transport: SmtpTransport | undefined;
  return {
    async send(message: EmailMessage) {
      transport ??= createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
      try {
        await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        });
      } catch (error) {
        const code = (error as { responseCode?: number; code?: string }).responseCode ??
          (error as { code?: string }).code ?? "unknown";
        throw new Error(`SMTP send failed (${code})`);
      }
    },
  };
}
