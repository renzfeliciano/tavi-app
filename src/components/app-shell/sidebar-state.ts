"use client";

import { useEffect, useSyncExternalStore } from "react";

// Whether the desktop sidebar is collapsed to icons. The choice is remembered
// in localStorage (the source of truth on this device) and mirrored to a
// cookie, so the server can render the right width on the first paint instead
// of the page jumping once the browser has read localStorage. The state lives
// on the shell element as `data-sidebar`; CSS reads it for widths, and React
// reads it here for tooltips and aria-expanded.

import { parseSidebarState, SHELL_ID, SIDEBAR_COOKIE, SIDEBAR_STORAGE_KEY, type SidebarState } from "./sidebar-preference";

export { parseSidebarState, SHELL_ID, SIDEBAR_COOKIE, SIDEBAR_STORAGE_KEY };
export type { SidebarState };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const shell = () => (typeof document === "undefined" ? null : document.getElementById(SHELL_ID));
const isCollapsed = () => shell()?.dataset.sidebar === "collapsed";

/** Applies a state to the page, and remembers it (storage can be unavailable: then it lasts for the visit). */
export function setSidebarState(state: SidebarState, { remember = true }: { remember?: boolean } = {}) {
  const element = shell();
  if (!element) return;
  element.dataset.sidebar = state;
  if (remember) {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
    } catch {
      // A private window or blocked storage: the cookie below still carries it.
    }
    document.cookie = `${SIDEBAR_COOKIE}=${state}; path=/; max-age=31536000; samesite=lax`;
  }
  for (const listener of listeners) listener();
}

export const toggleSidebar = () => setSidebarState(isCollapsed() ? "expanded" : "collapsed");

/** True while the sidebar is collapsed to icons. The server always renders "expanded" here; the data attribute handles layout. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, isCollapsed, () => false);
}

/** Brings the page in line with what this device remembers (the cookie may be missing or stale). Mount once. */
export function useRememberedSidebar() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    } catch {
      return;
    }
    if (saved !== null && parseSidebarState(saved) !== (isCollapsed() ? "collapsed" : "expanded")) {
      setSidebarState(parseSidebarState(saved));
    }
  }, []);
}

/** Ctrl+B (⌘B on a Mac) toggles the sidebar. Mount once, only where the sidebar is on screen. */
export function useSidebarShortcut() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      event.preventDefault();
      toggleSidebar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
