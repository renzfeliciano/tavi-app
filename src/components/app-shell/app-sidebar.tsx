"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isActive, type NavItem, newActions, primaryNav, settingsNav } from "./nav";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-(--duration-fast)",
        active
          ? "bg-card text-foreground shadow-xs ring-1 ring-border"
          : "text-ink-subtle hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          active ? "text-stamp" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {item.label}
    </Link>
  );
}

/** Desktop navigation (lg and up). */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" className="rounded-sm">
          <Wordmark size={19} />
        </Link>
      </div>

      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="w-full justify-start" />}>
            <PlusIcon aria-hidden="true" />
            New
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {newActions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.href}
                  render={<Link href={action.href} />}
                  className="items-start gap-2.5 py-2"
                >
                  <Icon aria-hidden="true" className="mt-0.5 text-muted-foreground" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{action.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="grid gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-2 border-t border-sidebar-border p-3">
        <SidebarLink item={settingsNav} pathname={pathname} />
      </div>
    </aside>
  );
}
