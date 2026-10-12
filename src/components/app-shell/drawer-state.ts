"use client";

import { useEffect, useSyncExternalStore } from "react";

// Whether the phone/tablet navigation drawer is open. Several pieces open it
// (the top bar's menu button, the tab bar's Menu), and it closes itself on
// navigation and when the window grows to the desktop layout, so it lives in a
// tiny shared store rather than in any one component.

let open = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function setDrawerOpen(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export const useDrawerOpen = (): boolean => useSyncExternalStore(subscribe, () => open, () => false);

/** The width at which the sidebar replaces the drawer (Tailwind's `lg`). */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Closes the drawer when the window becomes wide enough for the sidebar. Mount once with the drawer. */
export function useCloseDrawerOnDesktop() {
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => query.matches && setDrawerOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
}
