import { z } from "zod";

// Every environment variable the server reads is declared here. Later phases
// add email, Sentry, storage, etc. Values are never echoed in errors.

const postgresUrl = (name: string) =>
  z
    .string()
    .regex(/^postgres(ql)?:\/\/[^\s]+$/, {
      error: `${name} must be a postgres:// or postgresql:// connection string`,
    })
    .optional();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"], {
        error: "NODE_ENV must be development, test or production",
      })
      .default("development"),
    APP_URL: z
      .url({
        protocol: /^https?$/,
        error: "APP_URL must be an absolute http(s) URL",
      })
      .default("http://localhost:3200")
      .transform((url) => url.replace(/\/+$/, "")),
    /** Neon `dev` (locally) or `production` branch, pooled. Used by the app. */
    DATABASE_URL: postgresUrl("DATABASE_URL"),
    /** Same branch, pooling off. Used only by drizzle-kit migrations. */
    DATABASE_URL_DIRECT: postgresUrl("DATABASE_URL_DIRECT"),
    /** Neon `test` branch. Integration tests wipe it on every run. */
    TEST_DATABASE_URL: postgresUrl("TEST_DATABASE_URL"),
    /** Signs session cookies and tokens. Generate with `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, { error: "BETTER_AUTH_SECRET must be at least 32 characters" })
      .optional(),
    /** Email provider. Without it, development prints emails and production refuses to send. */
    RESEND_API_KEY: z
      .string()
      .regex(/^re_[A-Za-z0-9_]+$/, { error: "RESEND_API_KEY must be a Resend API key (starts with re_)" })
      .optional(),
    /** Sender shown to recipients, on a domain verified in Resend. */
    EMAIL_FROM: z
      .string()
      .regex(/^[^<>]+ <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/, {
        error: 'EMAIL_FROM must look like "Tavi <notify@your-domain.com>"',
      })
      .optional(),
    /** Shared secret Vercel Cron sends as a Bearer token to /api/cron/* routes. */
    CRON_SECRET: z
      .string()
      .min(32, { error: "CRON_SECRET must be at least 32 characters" })
      .optional(),
  })
  .superRefine((env, ctx) => {
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(env.APP_URL);
    if (env.NODE_ENV === "production" && !env.APP_URL.startsWith("https://") && !isLocalhost) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must use https in production",
      });
    }
    if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required in production",
      });
    }
    if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET is required in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables. Throws one error that names every
 * invalid variable. Values are never included, since they may be secrets.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  throw new Error(
    `Invalid environment configuration:\n${problems.join("\n")}\nSee .env.example for the expected variables.`,
  );
}
