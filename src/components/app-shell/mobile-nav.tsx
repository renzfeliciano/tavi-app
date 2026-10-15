"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, PlusIcon } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
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
import { setDrawerOpen, useCloseDrawerOnDesktop, useDrawerOpen } from "./drawer-state";
import { SidebarBody, type SidebarProps } from "./sidebar-body";
import {
  isActive,
  mobileTabs,
  type NavItem,
  newMenuFor,
  withDocumentNames,
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

/** Top bar (phones and tablets): the menu button, the Stamp's tile and the business's name. */
export function MobileTopBar({ organizationName }: { organizationName: string }) {
  return (
    // A modal that opens before this hydrates makes Base UI mark it aria-hidden; that is not a mismatch (hydration.test.tsx).
    <header
      suppressHydrationWarning
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-2 backdrop-blur-sm lg:hidden"
    >
      <button
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        onClick={() => setDrawerOpen(true)}
        className="grid size-11 shrink-0 place-items-center rounded-md text-foreground outline-none transition-colors duration-(--duration-fast) ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/35 active:bg-muted"
      >
        <MenuIcon aria-hidden="true" className="size-5" />
      </button>
      <Link href="/dashboard" className="flex h-11 shrink-0 items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/35">
        <AppLogo size={32} />
      </Link>
      <span className="min-w-0 truncate text-base font-semibold tracking-tight">{organizationName}</span>
    </header>
  );
}

/**
 * The navigation drawer (below the desktop layout): the same sidebar, sliding
 * in from the left over a backdrop. Focus stays inside while it is open, Escape
 * and the backdrop close it, and so does choosing anything or changing page.
 */
export function MobileDrawer(props: Omit<SidebarProps, "variant" | "onNavigate">) {
  const open = useDrawerOpen();
  const pathname = usePathname();
  useCloseDrawerOnDesktop();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setDrawerOpen}>
      <SheetContent side="left" className="w-[min(20rem,88vw)] gap-0 bg-sidebar p-0 sm:max-w-none lg:hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Move around {brand.name}, switch business, or sign out</SheetDescription>
        </SheetHeader>
        <SidebarBody {...props} variant="drawer" onNavigate={() => setDrawerOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** Bottom tab bar with a central "New" action (phones and tablets). */
export function MobileTabBar({ account }: { account: ShellAccount }) {
  const pathname = usePathname();
  const [newOpen, setNewOpen] = useState(false);
  const [home, quotes, invoices] = withDocumentNames(mobileTabs, account.documents, { short: true });

  return (
    // A floating pill, inset from the screen edges and the home indicator. The
    // wrapper ignores touches so only the pill itself is tappable. A modal that opens before this hydrates makes Base UI mark it aria-hidden; that is not a mismatch (hydration.test.tsx).
    <div
      suppressHydrationWarning
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <nav
        aria-label="Main"
        className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm"
      >
      <div className="flex items-stretch px-1">
        {home && <Tab item={home} pathname={pathname} />}
        {quotes && <Tab item={quotes} pathname={pathname} />}

        <Sheet open={newOpen} onOpenChange={setNewOpen}>
          <SheetTrigger className={cn(TAB, "group/new text-foreground")}>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-(--duration-fast) motion-reduce:transition-none",
                // A rubber-stamp press: down on touch, and once more as the sheet opens.
                "group-active/new:translate-y-0.5 group-active/new:scale-95",
                newOpen && "animate-stamp-press",
              )}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </span>
            New
          </SheetTrigger>
          <SheetContent side="bottom" className="gap-2">
            <SheetHeader>
              <SheetTitle>Create something new</SheetTitle>
              <SheetDescription>Start with a {account.documents.quote.singular.toLowerCase()}, or bill finished work directly.</SheetDescription>
            </SheetHeader>
            <SheetLinkList items={newMenuFor(account.documents, { canRecordPayments: account.canRecordPayments, canPurchase: account.canWritePurchasing })} onNavigate={() => setNewOpen(false)} withDescriptions />
          </SheetContent>
        </Sheet>

        {invoices && <Tab item={invoices} pathname={pathname} />}

        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
          className={cn(TAB, "text-muted-foreground outline-none focus-visible:text-foreground")}
        >
          <MenuIcon aria-hidden="true" className="size-5" />
          Menu
        </button>
      </div>
    </nav>
    </div>
  );
}
