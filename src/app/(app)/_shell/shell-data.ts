import { cache } from "react";
import { redirect } from "next/navigation";
import type { ShellAccount } from "@/components/app-shell/account";
import { can } from "@/modules/authz";
import { needsTermsAcceptance, requireOrgContext } from "@/modules/identity";
import { listMyBusinesses } from "@/modules/organizations";

/**
 * Everything the app shell (sidebar, top and tab bars, banner, overlays) needs
 * about the signed-in person. Cached per request, so the several shell pieces
 * that each ask for it cost one lookup, and none of them sit in front of the page.
 *
 * `requireOrgContext` is still the real gate for the shell: it redirects to
 * sign-in or onboarding. Every page and action also calls it on its own.
 */
export const loadShell = cache(async () => {
  const ctx = await requireOrgContext();
  // After a material change to the Terms or Privacy Notice (D15), agree again first.
  if (needsTermsAcceptance(ctx.termsVersion)) redirect("/accept-terms");
  const businesses = await listMyBusinesses(ctx.userId);
  const account: ShellAccount = {
    organizationName: ctx.organizationName,
    organizationCategory: ctx.organizationCategory,
    businesses: businesses.map((b) => ({
      id: b.organizationId,
      name: b.name,
      current: b.organizationId === ctx.organizationId,
    })),
    userName: ctx.userName,
    userEmail: ctx.userEmail,
    canReadReports: can(ctx, "reports.read"),
    documents: ctx.market.documents,
  };
  return { ctx, account };
});
