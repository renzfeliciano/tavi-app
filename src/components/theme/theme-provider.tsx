"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Theme } from "@/shared/theme/theme";

// The theme the server read from the cookie, for the controls that show it.
// The page itself is themed by CSS alone (globals.css), never by this context.
const ThemeContext = createContext<Theme>("system");

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
