import { z } from "zod";

// Every environment variable the server reads is declared here. Phase 0.2 adds
// DATABASE_URL / DATABASE_URL_DIRECT; later phases add email, Sentry, etc.
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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.APP_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must use https in production",
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
