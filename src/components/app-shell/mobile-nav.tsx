"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import type { ShellAccount } from "./account";
import { AccountBlock } from "./account-menu";
import {
  isActive,
  mobileMore,
  mobileTabs,
  type NavItem,
  newActions,
} from "./nav";

const TAB =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-(--duration-fast)";

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(TAB, active ? "text-stamp" : "text-muted-foreground")}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      {item.label}
    </Link>
  );
}

function SheetLinkList({
  items,
  onNavigate,
  withDescriptions = false,
}: {
  items: readonly (NavItem & { description?: string })[];
  onNavigate: () => void;
  withDescriptions?: boolean;
}) {
  return (
    <ul className="grid gap-1 px-2 pb-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-(--duration-fast) hover:bg-accent active:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-card">
                <Icon aria-hidden="true" className="size-[18px] text-ink-subtle" />
              </span>
              <span className="grid">
                <span className="text-[0.9375rem] font-medium">{item.label}</span>
                {withDescriptions && item.description && (
                  <span className="text-sm text-muted-foreground">{item.description}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Top bar (phones and tablets). */
export function MobileTopBar({ organizationName }: { organizationName: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm lg:hidden">
      <Link href="/dashboard" className="flex h-11 shrink-0 items-center rounded-sm">
        <Wordmark size={18} />
      </Link>
      <span className="truncate text-sm text-muted-foreground">{organizationName}</span>
    </header>
  );
}

/** Bottom tab bar with a central "New" action (phones and tablets). */
export function MobileTabBar({
  account,
  signOutAction,
  switchAction,
}: {
  account: ShellAccount;
  signOutAction: () => Promise<void>;
  switchAction: (organizationId: string) => Promise<void>;
}) {
  const pathname = usePathname();
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMore.some((item) => isActive(pathname, item.href));
  const [home, quotes, invoices] = mobileTabs;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1">
        {home && <Tab item={home} pathname={pathname} />}
        {quotes && <Tab item={quotes} pathname={pathname} />}

        <Sheet open={newOpen} onOpenChange={setNewOpen}>
          <SheetTrigger className={cn(TAB, "text-foreground")}>
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <PlusIcon aria-hidden="true" className="size-5" />
            </span>
            New
          </SheetTrigger>
          <SheetContent side="bottom" className="gap-2">
            <SheetHeader>
              <SheetTitle>Create something new</SheetTitle>
              <SheetDescription>Start with a quote, or bill finished work directly.</SheetDescription>
            </SheetHeader>
            <SheetLinkList items={newActions} onNavigate={() => setNewOpen(false)} withDescriptions />
          </SheetContent>
        </Sheet>

        {invoices && <Tab item={invoices} pathname={pathname} />}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={cn(TAB, moreActive ? "text-stamp" : "text-muted-foreground")}
          >
            <EllipsisIcon aria-hidden="true" className="size-5" />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="gap-2">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
              <SheetDescription className="sr-only">Other sections of {brand.name}</SheetDescription>
            </SheetHeader>
            <SheetLinkList items={mobileMore} onNavigate={() => setMoreOpen(false)} />
            <div className="border-t border-border px-4 pt-3 pb-4">
              <AccountBlock account={account} signOutAction={signOutAction} switchAction={switchAction} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
