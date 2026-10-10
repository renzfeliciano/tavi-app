"use client";

import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
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
  mobileMoreFor,
  mobileTabs,
  type NavItem,
  newActionsFor,
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

/** Top bar (phones and tablets). */
export function MobileTopBar({ organizationName, category }: { organizationName: string; category: string | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm lg:hidden">
      <Link href="/dashboard" className="flex h-11 shrink-0 items-center rounded-sm">
        <Wordmark size={18} />
      </Link>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {category && <CategoryIcon code={category} className="size-3.5 shrink-0" />}
        <span className="truncate">{organizationName}</span>
      </span>
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
  const more = mobileMoreFor(account);
  const moreActive = more.some((item) => isActive(pathname, item.href));
  const [home, quotes, invoices] = withDocumentNames(mobileTabs, account.documents, { short: true });

  return (
    // A floating pill, inset from the screen edges and the home indicator. The
    // wrapper ignores touches so only the pill itself is tappable.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
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
              <SheetDescription>Start with a quote, or bill finished work directly.</SheetDescription>
            </SheetHeader>
            <SheetLinkList items={newActionsFor(account.documents)} onNavigate={() => setNewOpen(false)} withDescriptions />
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
            <SheetLinkList items={more} onNavigate={() => setMoreOpen(false)} />
            <div className="border-t border-border px-4 pt-3 pb-4">
              <AccountBlock account={account} signOutAction={signOutAction} switchAction={switchAction} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
    </div>
  );
}
