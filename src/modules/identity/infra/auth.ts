import "server-only";
import { getDb } from "@/db";
import { env } from "@/shared/env";
import { type Auth, createAuth } from "./create-auth";

const globalForAuth = globalThis as unknown as { taviAuth?: Auth };

/** The app's Better Auth instance, created on first use. */
export function getAuth(): Auth {
  globalForAuth.taviAuth ??= createAuth(getDb(), {
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    rateLimit: env.NODE_ENV === "production",
    checkBreachedPasswords: env.NODE_ENV !== "test",
  });
  return globalForAuth.taviAuth;
}
