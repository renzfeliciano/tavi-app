import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileTabBar, MobileTopBar } from "@/components/app-shell/mobile-nav";

// The signed-in product shell. Authentication and the org context arrive in
// Phase 0.3; until then these routes only render placeholders.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppSidebar />
      <MobileTopBar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}
