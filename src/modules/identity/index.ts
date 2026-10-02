import "server-only";
import { getAuth } from "./infra/auth";

export {
  activateOrganization,
  getCurrentSession,
  type OrgContext,
  requireOrgContext,
  requireSession,
  type SignedInSession,
} from "./application/request-context";
export {
  type DeviceSession,
  forgetSessionCookies,
  listMyDevices,
  signOutCurrentSession,
  signOutDevice,
  signOutOtherDevices,
} from "./application/account";
export { listVerifiedEmails } from "./application/users";
export { type AcceptTermsResult, acceptTerms } from "./application/terms";
export { confirmCurrentPassword, type PasswordCheck } from "./application/password-check";
export { anonymiseUser, getAccountForExport } from "./infra/user-repository";
export { CLOSED_ACCOUNT_NAME } from "./domain/account-closure";
export { needsTermsAcceptance } from "./domain/terms";
export { SESSION_POLICY } from "./domain/session-policy";

/** Better Auth instance for the /api/auth route handler and server actions. */
export const authHandler = getAuth;
