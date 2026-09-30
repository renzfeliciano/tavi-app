import type { EmailMessage, EmailSender } from "../domain/email";

/**
 * Development sender: prints the email (including its links) to the server
 * console. Refuses to run in production, where links are credentials and must
 * never reach logs. A real provider (Resend) is wired in Phase 0.5.
 */
export const consoleSender: EmailSender = {
  async send(message: EmailMessage) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("No email provider is configured for production.");
    }
    console.info(
      `\n[email] to=${message.to}\n[email] subject=${message.subject}\n${message.text}\n`,
    );
  },
};

/** Test sender: keeps sent emails in memory so tests can read links from them. */
export function createMemorySender() {
  const sent: EmailMessage[] = [];
  const sender: EmailSender = {
    async send(message) {
      sent.push(message);
    },
  };
  return { sender, sent };
}
