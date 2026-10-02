import { ArrowLeftRightIcon, LogOutIcon } from "lucide-react";
import type { ShellAccount } from "./account";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "");
  return letters.toUpperCase() || "?";
}

/** Who is signed in, their other businesses (D17), plus sign out. Used at the foot of the sidebar and in More. */
export function AccountBlock({
  account,
  signOutAction,
  switchAction,
}: {
  account: ShellAccount;
  signOutAction: () => Promise<void>;
  switchAction: (organizationId: string) => Promise<void>;
}) {
  const others = account.businesses.filter((b) => !b.current);
  return (
    <div className="grid gap-3">
      {others.length > 0 && (
        <nav aria-label="Switch business" className="grid gap-0.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">Switch business</span>
          {others.map((business) => (
            <form key={business.id} action={switchAction.bind(null, business.id)}>
              <button
                type="submit"
                className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left text-sm text-ink-subtle transition-colors duration-(--duration-fast) hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none pointer-coarse:h-11"
              >
                <ArrowLeftRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{business.name}</span>
              </button>
            </form>
          ))}
        </nav>
      )}
      <AccountRow account={account} signOutAction={signOutAction} />
    </div>
  );
}

function AccountRow({ account, signOutAction }: { account: ShellAccount; signOutAction: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full border border-border-strong bg-card text-xs font-medium text-ink-subtle"
      >
        {initials(account.userName)}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{account.userName}</span>
        <span className="truncate text-xs text-muted-foreground">{account.userEmail}</span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none pointer-coarse:size-11"
        >
          <LogOutIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}
