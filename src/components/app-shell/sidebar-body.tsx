"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShellAccount } from "./account";
import { CollapsedTip } from "./collapsed-tip";
import type { ShellFacts } from "./facts";
import { navGroupsFor, newMenuFor } from "./nav";
import { NewMenu } from "./new-menu";
import { SidebarNav } from "./sidebar-nav";
import { toggleSidebar, useSidebarCollapsed } from "./sidebar-state";
import { TodayCard } from "./today-card";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export type SidebarProps = {
  account: ShellAccount;
  /** Streams in beside the page: the counts, the Today card and the Stamp's mood fill in when it lands. */
  facts: Promise<ShellFacts>;
  /** False when the Stamp's insights are switched off: Today then keeps its figures but not the Stamp's line. */
  showNote: boolean;
  signOutAction: () => Promise<void>;
  switchAction: (organizationId: string) => Promise<void>;
  /** The drawer is never collapsed: it always shows the full sidebar. */
  variant: "desktop" | "drawer";
  /** The drawer closes itself when something in it is chosen. */
  onNavigate?: () => void;
};

/** Collapse / expand, with Ctrl+B (⌘B on a Mac). Desktop only. */
function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <CollapsedTip
      label={
        <>
          {label}
          <kbd className="rounded-sm bg-background/20 px-1 font-sans text-[0.6875rem]">Ctrl B</kbd>
        </>
      }
      active={collapsed}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar"
        aria-keyshortcuts="Control+B Meta+B"
        className="group/row flex h-9 w-full items-center gap-3 rounded-md px-3 text-nav font-medium text-ink-subtle outline-none transition-colors duration-(--duration-fast) ease-out hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 active:bg-sidebar-accent pointer-coarse:h-11 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0"
      >
        {collapsed ? (
          <PanelLeftOpenIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        ) : (
          <PanelLeftCloseIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate group-data-[sidebar=collapsed]/shell:sr-only">Collapse</span>
        <kbd className="ml-auto rounded-sm border border-border px-1.5 font-sans text-[0.6875rem] text-muted-foreground group-data-[sidebar=collapsed]/shell:hidden">
          Ctrl B
        </kbd>
      </button>
    </CollapsedTip>
  );
}

/**
 * Everything inside the sidebar, shared by the desktop column and the phone
 * drawer: the business switcher, New, the grouped links, Today, and the person.
 */
export function SidebarBody({ account, facts, showNote, signOutAction, switchAction, variant, onNavigate }: SidebarProps) {
  const shellCollapsed = useSidebarCollapsed();
  const collapsed = variant === "desktop" && shellCollapsed;

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", variant === "drawer" && "pt-1")}>
      <div className={cn("p-3 pb-2", variant === "drawer" && "pr-14", "group-data-[sidebar=collapsed]/shell:px-2")}>
        <WorkspaceSwitcher account={account} facts={facts} switchAction={switchAction} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <div className="px-3 pb-3">
        <NewMenu actions={newMenuFor(account.documents, { canRecordPayments: account.canRecordPayments, canPurchase: account.canWritePurchasing })} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      {/* Links and Today scroll together, so a short window never hides the foot of the sidebar. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin]">
        <SidebarNav groups={navGroupsFor(account)} facts={facts} collapsed={collapsed} onNavigate={onNavigate} />
        <TodayCard facts={facts} documents={account.documents} showNote={showNote} />
      </div>
      {/* One column that may shrink: with the default `auto` column a long account name would widen the foot past the sidebar and push "Ctrl B" out. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1 border-t border-sidebar-border p-3">
        {variant === "desktop" && <CollapseToggle collapsed={collapsed} />}
        <UserMenu account={account} signOutAction={signOutAction} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

