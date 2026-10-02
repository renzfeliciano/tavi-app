import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { ShellAccount } from "@/components/app-shell/account";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileTabBar, MobileTopBar } from "@/components/app-shell/mobile-nav";
import { VerifyEmailBanner } from "@/components/app-shell/verify-email-banner";
import { needsTermsAcceptance, requireOrgContext } from "@/modules/identity";
import { listMyBusinesses } from "@/modules/organizations";
import { signOut, switchBusiness } from "./actions";

// The signed-in product shell. `requireOrgContext` is the real gate: it
// redirects to sign-in without a valid session and to onboarding without an
// organization. proxy.ts only does a fast, optimistic cookie check.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  // After a material change to the Terms or Privacy Notice (D15), agree again first.
  if (needsTermsAcceptance(ctx.termsVersion)) redirect("/accept-terms");
  const businesses = await listMyBusinesses(ctx.userId);
  const account: ShellAccount = {
    organizationName: ctx.organizationName,
    businesses: businesses.map((b) => ({
      id: b.organizationId,
      name: b.name,
      current: b.organizationId === ctx.organizationId,
    })),
    userName: ctx.userName,
    userEmail: ctx.userEmail,
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
      <MobileTopBar organizationName={account.organizationName} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {!ctx.emailVerified && <VerifyEmailBanner email={ctx.userEmail} />}
          {children}
        </div>
      </main>
      <MobileTabBar account={account} signOutAction={signOut} switchAction={switchBusiness} />
    </div>
  );
}
