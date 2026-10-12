"use client";

import { SidebarBody, type SidebarProps } from "./sidebar-body";
import { useRememberedSidebar, useSidebarShortcut } from "./sidebar-state";

/**
 * Desktop navigation (lg and up). Its width is `--sidebar-w`, which the shell
 * flips when the sidebar is collapsed, so the column, the page beside it and
 * the animation between the two all follow one value.
 */
export function AppSidebar(props: Omit<SidebarProps, "variant" | "onNavigate">) {
  useRememberedSidebar();
  useSidebarShortcut();

  return (
    // A modal that opens before this hydrates makes Base UI mark it aria-hidden; that is not a mismatch (hydration.test.tsx).
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      suppressHydrationWarning
      className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-(--duration-slow) ease-(--ease-drawer) motion-reduce:transition-none lg:block"
    >
      <SidebarBody {...props} variant="desktop" />
    </aside>
  );
}
