export type EmailTransportKind = "resend" | "smtp" | "console";

type EmailEnv = {
  RESEND_API_KEY?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
};

/**
 * Resend once a domain is verified; Gmail SMTP on the free tier (D11);
 * otherwise the console sender (development only; it refuses in production).
 */
export function chooseEmailTransport(env: EmailEnv): EmailTransportKind {
  if (!env.EMAIL_FROM) return "console";
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_USER && env.SMTP_PASSWORD) return "smtp";
  return "console";
}
