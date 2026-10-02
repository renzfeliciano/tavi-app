import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type MarketProfile, marketFor } from "@/config/markets";
import type { Role } from "@/modules/authz";
import { resolveMembership } from "@/modules/organizations";
import { isPastAbsoluteLifetime } from "../domain/session-policy";
import { getAuth } from "../infra/auth";
import { setSessionActiveOrganization } from "../infra/session-repository";

export type SignedInSession = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    /** The Terms/Privacy version agreed to; null for accounts from before sign-up asked. */
    termsVersion: string | null;
  };
  session: { id: string; token: string; activeOrganizationId: string | null };
};

/**
 * The signed-in session for this request, or null. Memoized per request.
 * Enforces the 30-day absolute lifetime that Better Auth's sliding expiry
 * doesn't (§D): an over-age session is revoked and treated as signed out.
 */
export const getCurrentSession = cache(async (): Promise<SignedInSession | null> => {
  const requestHeaders = await headers();
  const auth = getAuth();
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;

  if (isPastAbsoluteLifetime(new Date(result.session.createdAt), new Date())) {
    await auth.api
      .revokeSession({ headers: requestHeaders, body: { token: result.session.token } })
      .catch(() => undefined);
    return null;
  }

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      termsVersion: (result.user as { termsVersion?: string | null }).termsVersion ?? null,
    },
    session: {
      id: result.session.id,
      token: result.session.token,
      activeOrganizationId: result.session.activeOrganizationId ?? null,
    },
  };
});

/** For pages and actions that need a signed-in user. Redirects to sign-in otherwise. */
export async function requireSession(): Promise<SignedInSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Everything authorization needs, resolved on the server (§8, §E). */
export type OrgContext = {
  userId: string;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  /** The Terms/Privacy version this person agreed to (the app layout asks again when it's out of date). */
  termsVersion: string | null;
  sessionId: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  /** The business's market profile: wording, tax suggestions, formats. */
  market: MarketProfile;
  /** The business's own settings (they may differ from its market's defaults). */
  currency: string;
  locale: string;
  timezone: string;
};

/**
 * The organization this request acts in. Redirects to sign-in without a
 * session and to onboarding without an organization. The organization comes
 * from the session and the user's memberships, never from the request.
 */
export const requireOrgContext = cache(async (): Promise<OrgContext> => {
  const { user, session } = await requireSession();
  const membership = await resolveMembership(user.id, session.activeOrganizationId);
  if (!membership) redirect("/onboarding");

  if (membership.organizationId !== session.activeOrganizationId) {
    await setSessionActiveOrganization(session.id, membership.organizationId);
  }

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    emailVerified: user.emailVerified,
    termsVersion: user.termsVersion,
    sessionId: session.id,
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    role: membership.role,
    market: marketFor(membership.countryCode),
    currency: membership.currency,
    locale: membership.locale,
    timezone: membership.timezone,
  };
});

/** Switches this session to an organization the user belongs to. */
export async function activateOrganization(sessionId: string, organizationId: string) {
  await setSessionActiveOrganization(sessionId, organizationId);
}
