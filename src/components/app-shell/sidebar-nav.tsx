"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import { cn } from "@/lib/utils";
import { CollapsedTip } from "./collapsed-tip";
import type { ShellFacts } from "./facts";
import { badgeFor, isActive, type NavGroup, type NavItem } from "./nav";

/**
 * One row of the sidebar. The look is one shape for every row: a quiet label,
 * a filled pill on hover and press, and the same pill with a violet icon for
 * the page you are on. `group-data-[sidebar=collapsed]/shell` is the collapsed
 * state, set on the shell by CSS alone, so the first paint is already right.
 */
const ROW =
  "group/row relative flex h-9 short:h-8 items-center gap-3 rounded-md px-3 text-nav font-medium outline-none transition-[background-color,color] duration-(--duration-fast) ease-out focus-visible:ring-3 focus-visible:ring-ring/35 active:bg-sidebar-accent pointer-coarse:h-11 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0";

const BADGE =
  "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-eyebrow leading-none font-semibold tabular-nums group-data-[sidebar=collapsed]/shell:absolute group-data-[sidebar=collapsed]/shell:top-0.5 group-data-[sidebar=collapsed]/shell:right-2.5 group-data-[sidebar=collapsed]/shell:ml-0 group-data-[sidebar=collapsed]/shell:h-4 group-data-[sidebar=collapsed]/shell:min-w-4 group-data-[sidebar=collapsed]/shell:px-1 group-data-[sidebar=collapsed]/shell:text-[0.625rem]";

/** The count beside a link (overdue billing statements, draft quotations). Streams in; nothing waits for it. */
function NavBadgeView({ href, facts }: { href: string; facts: Promise<ShellFacts> }) {
  const badge = badgeFor(href, use(facts));
  if (!badge) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(BADGE, badge.tone === "alert" ? "bg-danger-subtle text-danger-strong" : "bg-muted text-ink-subtle")}
      >
        {badge.text}
      </span>
      <span className="sr-only">, {badge.label}</span>
    </>
  );
}

const hasBadge = (href: string) => href === "/invoices" || href === "/quotes";

function NavLink({
  item,
  active,
  collapsed,
  facts,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  facts: Promise<ShellFacts>;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <CollapsedTip label={item.label} active={collapsed}>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          ROW,
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-ink-subtle hover:bg-sidebar-accent/60 hover:text-foreground",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-5 shrink-0 transition-colors duration-(--duration-fast)", active ? "text-stamp" : "text-muted-foreground group-hover/row:text-foreground")}
        />
        <span className="truncate group-data-[sidebar=collapsed]/shell:sr-only">{item.label}</span>
        {hasBadge(item.href) && (
          <Suspense fallback={null}>
            <NavBadgeView href={item.href} facts={facts} />
          </Suspense>
        )}
      </Link>
    </CollapsedTip>
  );
}

/** The grouped links: a small heading per group, which becomes a thin divider when the sidebar is collapsed. */
export function SidebarNav({
  groups,
  facts,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  facts: Promise<ShellFacts>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid content-start gap-4 px-3 py-1 short:gap-3">
      {groups.map((group) => (
        <div key={group.id} className="grid gap-0.5">
          {group.label && (
            <>
              <h2 className="px-3 pb-1 text-eyebrow font-semibold tracking-wider text-muted-foreground uppercase group-data-[sidebar=collapsed]/shell:hidden">
                {group.label}
              </h2>
              <hr aria-hidden="true" className="mx-2 mb-1 hidden border-sidebar-border group-data-[sidebar=collapsed]/shell:block" />
            </>
          )}
          <ul className="grid gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                  facts={facts}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
