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
  listMyDevices,
  signOutCurrentSession,
  signOutDevice,
  signOutOtherDevices,
} from "./application/account";
export { listVerifiedEmails } from "./application/users";
export { SESSION_POLICY } from "./domain/session-policy";

/** Better Auth instance for the /api/auth route handler and server actions. */
export const authHandler = getAuth;
