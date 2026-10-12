"use client";

import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { Suspense, use, useTransition } from "react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ShellAccount } from "./account";
import { noteFor, type ShellFacts } from "./facts";

/** The Stamp, looking the way the business is doing (the same mood the Today card speaks in). */
function MoodMascot({ facts }: { facts: Promise<ShellFacts> }) {
  return <BrandMascot size="md" expression={noteFor(use(facts)).mood} className="shrink-0" />;
}

/**
 * The top of the sidebar: the Stamp and the business's name, which is also the
 * switcher between the person's businesses (D17) and the way to add another.
 * Collapsed, only the Stamp is left; the name stays as its accessible name.
 */
export function WorkspaceSwitcher({
  account,
  facts,
  switchAction,
  collapsed,
  onNavigate,
}: {
  account: ShellAccount;
  facts: Promise<ShellFacts>;
  switchAction: (organizationId: string) => Promise<void>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={collapsed ? `${account.organizationName}, switch business` : undefined}
        className={cn(
          "group/switch flex w-full items-center gap-3 rounded-lg p-1.5 text-left outline-none transition-colors duration-(--duration-fast) ease-out hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/35 aria-expanded:bg-sidebar-accent group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:p-0",
          pending && "opacity-60",
        )}
      >
        <Suspense fallback={<BrandMascot size="md" expression="neutral" className="shrink-0" />}>
          <MoodMascot facts={facts} />
        </Suspense>
        <span className="line-clamp-2 min-w-0 flex-1 text-base leading-tight font-semibold tracking-tight break-words group-data-[sidebar=collapsed]/shell:sr-only">
          {account.organizationName}
        </span>
        <ChevronsUpDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-data-[sidebar=collapsed]/shell:hidden"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className={collapsed ? "w-64 min-w-64" : "w-(--anchor-width)"}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your businesses</DropdownMenuLabel>
          {account.businesses.map((business) => (
            <DropdownMenuItem
              key={business.id}
              aria-current={business.current ? "true" : undefined}
              onClick={() => {
                if (business.current) return;
                onNavigate?.();
                startTransition(() => switchAction(business.id));
              }}
              className="gap-2.5"
            >
              <span className="min-w-0 flex-1 truncate">{business.name}</span>
              {business.current && <CheckIcon aria-hidden="true" className="text-stamp" />}
              {business.current && <span className="sr-only">(current)</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding?new=1" onClick={onNavigate} />} className="gap-2.5">
          <PlusIcon aria-hidden="true" className="text-muted-foreground" />
          Add business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
