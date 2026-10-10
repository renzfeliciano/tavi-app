/**
 * The Stamp's greeting right after sign-in (D20). The sign-in form leaves a
 * timestamped mark in sessionStorage; the app shell takes it once. A mark that
 * is old, unreadable or already taken means no greeting, so navigating,
 * refreshing or coming back later never replays it.
 */

const KEY = "tavi:welcome";

/** A mark older than this belongs to some other visit. */
export const GREETING_WINDOW_MS = 60_000;
/** How long the greeting stays before it leaves. Change it here. */
export const GREETING_DURATION_MS = 2800;

export type GreetingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function markWelcome(storage: GreetingStorage, now: number = Date.now()): void {
  try {
    storage.setItem(KEY, String(now));
  } catch {
    // Storage can be blocked; the greeting is only a nicety.
  }
}

/** True exactly once after `markWelcome`, within the window. */
export function takeWelcome(storage: GreetingStorage, now: number = Date.now()): boolean {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return false;
    storage.removeItem(KEY);
    const at = Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at <= GREETING_WINDOW_MS;
  } catch {
    return false;
  }
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** The words in the bubble. Plain, no emoji (brand voice). */
export function welcomeMessage(fullName: string): string {
  const name = firstName(fullName);
  return name ? `Welcome back, ${name}.` : "Welcome back.";
}
