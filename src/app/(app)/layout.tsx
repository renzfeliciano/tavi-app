import { featureFlags } from "@/config/features";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import type { ShellAccount } from "@/components/app-shell/account";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { WelcomeGreeting } from "@/components/brand/welcome-greeting";
import { MobileTabBar, MobileTopBar } from "@/components/app-shell/mobile-nav";
import { VerifyEmailBanner } from "@/components/app-shell/verify-email-banner";
import { can } from "@/modules/authz";
import { needsTermsAcceptance, requireOrgContext } from "@/modules/identity";
import { listMyBusinesses } from "@/modules/organizations";
import { MascotInsights } from "./_mascot/mascot-insights";
import { IdleGuard } from "./_session/idle-guard";
import { signOut, switchBusiness } from "./actions";

// The signed-in product shell. `requireOrgContext` is the real gate: it
// redirects to sign-in without a valid session and to onboarding without an
// organization. proxy.ts only does a fast, optimistic cookie check.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const flags = featureFlags();
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppSidebar account={account} signOutAction={signOut} switchAction={switchBusiness} />
      <MobileTopBar organizationName={account.organizationName} category={account.organizationCategory} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {!ctx.emailVerified && <VerifyEmailBanner email={ctx.userEmail} />}
          {children}
        </div>
      </main>
      <IdleGuard />
      {flags.mascotEnabled && <WelcomeGreeting userName={ctx.userName} />}
      {/* Streams in after the page; no fallback, so nothing waits on it and nothing shifts. */}
      {flags.mascotInsightsEnabled && (
        <Suspense fallback={null}>
          <MascotInsights ctx={ctx} />
        </Suspense>
      )}
      <MobileTabBar account={account} signOutAction={signOut} switchAction={switchBusiness} />
    </div>
  );
}
