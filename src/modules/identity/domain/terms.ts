import { LEGAL } from "@/config/legal";

// Agreeing to the Terms of Service and Privacy Notice at sign-up (proposal
// §M 1.13b). The sign-up form sends the version the person saw and ticked;
// the server accepts only the current one, so a stale page or a request that
// skips the checkbox creates no account.

/** Better Auth error code for a sign-up without the current terms. */
export const TERMS_NOT_ACCEPTED = "TERMS_NOT_ACCEPTED";

export const TERMS_REQUIRED_MESSAGE = "Agree to the Terms of Service and Privacy Notice to create your account.";

/** The version agreed to, or null when it isn't exactly the current one. */
export function acceptedTermsVersion(value: unknown, current: string = LEGAL.version): string | null {
  return typeof value === "string" && value === current ? value : null;
}
