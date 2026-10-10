"use client";

import { CategoryIcon } from "@/components/category-icon";
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
import type { ShellAccount } from "./account";
import { AccountBlock } from "./account-menu";
import { isActive, type NavItem, newActionsFor, primaryNavFor, settingsNav, withDocumentNames } from "./nav";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-(--duration-fast)",
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
      {active && (
        <span aria-hidden="true" className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-stamp" />
      )}
    </Link>
  );
}

/** Desktop navigation (lg and up). */
export function AppSidebar({
  account,
  signOutAction,
  switchAction,
}: {
  account: ShellAccount;
  signOutAction: () => Promise<void>;
  switchAction: (organizationId: string) => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="grid gap-0.5 px-5 pt-4 pb-3">
        <Link href="/dashboard" className="w-fit rounded-sm">
          <Wordmark size={19} />
        </Link>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={account.organizationName}>
          {account.organizationCategory && (
            <CategoryIcon code={account.organizationCategory} className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{account.organizationName}</span>
        </span>
      </div>

      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="w-full justify-start" />}>
            <PlusIcon aria-hidden="true" />
            New
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {newActionsFor(account.documents).map((action) => {
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
          {withDocumentNames(primaryNavFor(account), account.documents).map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-2 border-t border-sidebar-border p-3">
        <SidebarLink item={settingsNav} pathname={pathname} />
        <div className="border-t border-sidebar-border pt-3">
          <AccountBlock account={account} signOutAction={signOutAction} switchAction={switchAction} />
        </div>
      </div>
    </aside>
  );
}
