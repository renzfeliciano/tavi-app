// Browser-safe exports of the identity module.
export { type AuthErrorLike, authErrorMessage } from "./domain/auth-errors";
export {
  LINK_LIFETIMES,
  PASSWORD_HINT,
  PASSWORD_POLICY,
  passwordResetLifetime,
} from "./domain/auth-policy";
export { clientIdleLimitMs, idleStatus, type IdleStatus, SESSION_POLICY } from "./domain/session-policy";
export { TERMS_REQUIRED_MESSAGE, TERMS_REQUIRED_TO_CONTINUE } from "./domain/terms";
