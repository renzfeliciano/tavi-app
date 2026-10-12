"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTheme } from "@/app/theme-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { htmlThemeAttribute, parseTheme, type Theme } from "@/shared/theme/theme";
import { ThemeGlyph } from "./theme-glyph";
import { useTheme } from "./theme-provider";

const CHOICES = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const satisfies readonly { value: Theme; label: string; icon: unknown }[];

/** Pins <html> at once so the change shows before the server answers. */
function showTheme(theme: Theme) {
  const attribute = htmlThemeAttribute(theme);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
}

/** What the theme control needs: the choices, the one showing, and how to change it (shared by the menu and the user menu). */
export function useThemeChoice() {
  const saved = useTheme();
  const [shown, setShown] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      showTheme(next);
      const result = await setTheme(next);
      if (!result.ok) {
        showTheme(saved);
        toast.error(`Couldn't change the theme. ${result.error}`);
      }
    });
  }

  return { shown, choose, choices: CHOICES };
}

/** The theme button: one icon, a short menu of System / Light / Dark, remembered on this device. */
export function ThemeMenu({ className }: { className?: string }) {
  const { shown, choose } = useThemeChoice();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Theme"
        className={cn(
          "grid size-9 place-items-center rounded-md text-foreground transition-colors duration-(--duration-fast) hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none pointer-coarse:size-11",
          className,
        )}
      >
        <ThemeGlyph />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={shown} onValueChange={(value) => choose(parseTheme(value))}>
          {CHOICES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" className="text-muted-foreground" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** For pages with no header of their own (sign-in, Terms…): pinned to the top-right corner. */
export function ThemeCorner() {
  return (
    <div className="fixed top-3 right-3 z-40 sm:top-4 sm:right-4">
      <ThemeMenu className="bg-card/80 ring-1 ring-border backdrop-blur-sm" />
    </div>
  );
}
