import { describeDuration } from "@/shared/format/duration";

// Password and link rules. Better Auth is configured from these, and every
// form, error message and email describes them from here too, so the copy can
// never drift from the behaviour.

export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
} as const;

export const LINK_LIFETIMES = {
  passwordResetSeconds: 30 * 60,
  emailVerificationSeconds: 24 * 60 * 60,
} as const;

export const PASSWORD_HINT = `At least ${PASSWORD_POLICY.minLength} characters. A short phrase works well.`;

export const passwordResetLifetime = () => describeDuration(LINK_LIFETIMES.passwordResetSeconds);
