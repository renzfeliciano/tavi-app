"use server";

import { cookies } from "next/headers";
import { isTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/shared/theme/theme";

export type SetThemeResult = { ok: true } | { ok: false; error: string };

/**
 * Remembers this device's colour theme (D24). A preference, not personal data:
 * a plain cookie, read on the server so the first paint is already right.
 * Deliberately open to signed-out visitors (sign-in and the Terms have the
 * control too): it touches no tenant data, so it needs no org context.
 */
export async function setTheme(value: string): Promise<SetThemeResult> {
  if (!isTheme(value)) return { ok: false, error: "Choose System, Light or Dark." };
  const store = await cookies();
  store.set(THEME_COOKIE, value, {
    maxAge: THEME_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return { ok: true };
}
