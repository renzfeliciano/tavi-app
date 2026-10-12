import { cookies } from "next/headers";
import { featureFlags } from "@/config/features";
import { type ReactNode, Suspense } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { ShellChromeFallback } from "@/components/app-shell/shell-loading";
import { WelcomeGreeting } from "@/components/brand/welcome-greeting";
import { MobileDrawer, MobileTabBar, MobileTopBar } from "@/components/app-shell/mobile-nav";
import { parseSidebarState, SHELL_ID, SIDEBAR_COOKIE } from "@/components/app-shell/sidebar-preference";
import { VerifyEmailBanner } from "@/components/app-shell/verify-email-banner";
import { IdleGuard } from "./_session/idle-guard";
import { loadShell } from "./_shell/shell-data";
import { loadShellFacts } from "./_shell/shell-facts";
import { signOut, switchBusiness } from "./actions";

// The signed-in product shell. Nothing in it waits on the person's session
// before the page can render: the page (with its own loading.tsx skeleton and
// the page loader) streams from the first byte, and the pieces that need the
// session (navigation, banner, overlays) fill in beside it in their own
// boundaries. `requireOrgContext` is still the real gate: the shell calls it
// (redirecting to sign-in or onboarding), and so does every page and action.
// proxy.ts only does a fast, optimistic cookie check.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // The sidebar's remembered width is a cookie, so the first paint is already the right one.
  const sidebar = parseSidebarState((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <div id={SHELL_ID} data-sidebar={sidebar} className="group/shell flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Suspense fallback={<ShellChromeFallback />}>
        <ShellChrome />
      </Suspense>
      {/* --page-loader-inset = the sidebar's width, so the page loader centres in the main panel, not the window. */}
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 outline-none transition-[padding] duration-(--duration-slow) ease-(--ease-drawer) motion-reduce:transition-none lg:pl-(--sidebar-w) lg:[--page-loader-inset:var(--sidebar-w)]"
      >
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Suspense fallback={null}>
            <ShellBanner />
          </Suspense>
          {children}
        </div>
      </main>
      {/* Stream in after the page; no fallback, so nothing waits on them and nothing shifts. */}
      <Suspense fallback={null}>
        <ShellOverlays />
      </Suspense>
    </div>
  );
}

/** Sidebar (desktop), the phone drawer and top bar. The counts stream in beside them (a promise, never awaited here). */
async function ShellChrome() {
  const { ctx, account } = await loadShell();
  const facts = loadShellFacts(ctx);
  const showNote = featureFlags().mascotInsightsEnabled;
  const props = { account, facts, showNote, signOutAction: signOut, switchAction: switchBusiness };
  return (
    <>
      <AppSidebar {...props} />
      <MobileTopBar organizationName={account.organizationName} />
      <MobileDrawer {...props} />
    </>
  );
}

async function ShellBanner() {
  const { ctx } = await loadShell();
  return ctx.emailVerified ? null : <VerifyEmailBanner email={ctx.userEmail} />;
}

/** Idle timeout, the welcome greeting and the phone tab bar. */
async function ShellOverlays() {
  const { ctx, account } = await loadShell();
  const flags = featureFlags();
  return (
    <>
      <IdleGuard />
      {flags.mascotEnabled && <WelcomeGreeting userName={ctx.userName} />}
      <MobileTabBar account={account} />
    </>
  );
}
