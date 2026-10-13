"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { initials } from "@/components/monogram";
import { useThemeChoice } from "@/components/theme/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ShellAccount } from "./account";
import { CollapsedTip } from "./collapsed-tip";
import { isActive } from "./nav";
import { useSignOut } from "./sign-out-button";

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-border-strong bg-card text-xs font-semibold text-ink-subtle",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** System / Light / Dark as a three-way switch (the theme control lives here now, not in the corner). */
function ThemeSwitch() {
  const { shown, choose, choices } = useThemeChoice();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
      {choices.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={shown === value}
          onClick={() => choose(value)}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-sm text-xs font-medium outline-none transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out focus-visible:ring-3 focus-visible:ring-ring/35 pointer-coarse:h-11",
            shown === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

const MENU_ROW =
  "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-sm outline-none transition-colors duration-(--duration-fast) ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/35 pointer-coarse:h-11";

/**
 * The foot of the sidebar: the person's avatar and name. Their email, Settings,
 * the theme and Sign out sit in the popover. Collapsed, only the avatar shows.
 */
export function UserMenu({
  account,
  signOutAction,
  collapsed,
  onNavigate,
}: {
  account: ShellAccount;
  signOutAction: () => Promise<void>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const onSettings = isActive(pathname, "/settings");
  const { pending, signOut, overlay } = useSignOut(signOutAction, account.userName);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <CollapsedTip label={account.userName} active={collapsed && !open}>
          <PopoverTrigger
            aria-label={collapsed ? `${account.userName}, account menu` : undefined}
            className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left outline-none transition-colors duration-(--duration-fast) ease-out hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/35 aria-expanded:bg-sidebar-accent group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:p-0"
          >
            <Avatar name={account.userName} />
            <span className="min-w-0 flex-1 truncate text-nav font-medium group-data-[sidebar=collapsed]/shell:sr-only">
              {account.userName}
            </span>
            <ChevronsUpDownIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground group-data-[sidebar=collapsed]/shell:hidden"
            />
          </PopoverTrigger>
        </CollapsedTip>
        <PopoverContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={8} className={cn("gap-1 p-2", collapsed ? "w-64" : "w-(--anchor-width)")}>
          <div className="flex items-center gap-3 px-1.5 py-1.5">
            <Avatar name={account.userName} className="size-10" />
            <div className="grid min-w-0">
              <span className="truncate font-medium">{account.userName}</span>
              <span className="truncate text-xs text-muted-foreground">{account.userEmail}</span>
            </div>
          </div>
          <hr className="-mx-2 border-border" />
          <Link
            href="/settings"
            aria-current={onSettings ? "page" : undefined}
            className={cn(MENU_ROW, onSettings && "bg-muted font-medium")}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            <SettingsIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            Settings
          </Link>
          <div className="px-0.5 py-1">
            <ThemeSwitch />
          </div>
          <hr className="-mx-2 border-border" />
          <button type="button" className={MENU_ROW} disabled={pending} onClick={signOut}>
            <LogOutIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            Sign out
          </button>
        </PopoverContent>
      </Popover>
      {overlay}
    </>
  );
}
