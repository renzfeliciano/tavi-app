// The sidebar's remembered state, in a module with no "use client" so the
// server layout can read the cookie with it (a client module's functions can't
// be called from the server). sidebar-state.ts re-exports these for the browser.

export const SHELL_ID = "app-shell";
export const SIDEBAR_STORAGE_KEY = "tavi:sidebar";
export const SIDEBAR_COOKIE = "tavi-sidebar";
export type SidebarState = "expanded" | "collapsed";

export const parseSidebarState = (value: string | null | undefined): SidebarState =>
  value === "collapsed" ? "collapsed" : "expanded";
