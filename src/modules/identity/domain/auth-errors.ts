import { brand } from "@/config/brand";
import { PASSWORD_POLICY } from "./auth-policy";

// Human copy for Better Auth errors (§28): what happened and what to do.
// Internal messages are never shown.

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Try again, or reset your password.",
  USER_ALREADY_EXISTS: `This email already has a ${brand.name} account. Sign in instead.`,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: `This email already has a ${brand.name} account. Sign in instead.`,
  PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_POLICY.minLength} characters. A short phrase works well.`,
  PASSWORD_TOO_LONG: `Use ${PASSWORD_POLICY.maxLength} characters or fewer.`,
  PASSWORD_COMPROMISED:
    "This password has appeared in a data breach. Choose a different one.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_TOKEN: "This link has expired or was already used. Request a new one.",
};

const GENERIC = "Something went wrong on our side. Please try again.";

export type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

export function authErrorMessage(error: AuthErrorLike): string {
  if (!error) return GENERIC;
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  return (error.code && MESSAGES[error.code]) || GENERIC;
}
