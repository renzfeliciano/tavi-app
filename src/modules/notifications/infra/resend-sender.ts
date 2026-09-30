import { type EmailMessage, type EmailSender, fromHeader } from "../domain/email";

type ResendOptions = {
  apiKey: string;
  /** e.g. "Tavi <notify@mail.tavi.ph>"; must be a domain verified in Resend. */
  from: string;
  fetch?: typeof fetch;
};

/** Resend over its HTTP API (no SDK needed). Errors carry the status, never the key. */
export function createResendSender({ apiKey, from, fetch: fetchImpl = fetch }: ResendOptions): EmailSender {
  return {
    async send(message: EmailMessage) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromHeader(from, message.senderName),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend rejected the email (HTTP ${response.status})`);
      }
    },
  };
}
