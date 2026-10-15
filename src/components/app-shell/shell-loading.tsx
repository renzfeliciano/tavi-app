import { Skeleton } from "@/components/ui/skeleton";

// Same rows, same heights and same column as SidebarBody, so when the real
// sidebar lands nothing moves. The nav is the shape most accounts have:
// Dashboard, then Sales (4), then Manage (4).
const NAV_GROUPS = [1, 4, 4] as const;
const COLLAPSED_HIDE = "group-data-[sidebar=collapsed]/shell:hidden";

function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col"
    >
      <div className="p-3 pb-2 group-data-[sidebar=collapsed]/shell:px-2">
        <div className="flex items-center gap-3 p-1.5 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:p-0">
          <Skeleton className="size-14 shrink-0 rounded-xl" />
          <div className={`grid flex-1 gap-1.5 ${COLLAPSED_HIDE}`}>
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
      <div className="grid content-start gap-4 px-3 py-1">
        {NAV_GROUPS.map((rows, group) => (
          <div key={group} className="grid gap-0.5">
            {group > 0 && <Skeleton className={`mx-3 mb-1.5 h-3 w-12 ${COLLAPSED_HIDE}`} />}
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex h-9 items-center gap-3 px-3 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0">
                <Skeleton className="size-5 shrink-0" />
                <Skeleton className={`h-4 flex-1 ${COLLAPSED_HIDE}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={`mx-3 mt-4 mb-3 grid gap-2 rounded-lg border border-border bg-card p-3 ${COLLAPSED_HIDE}`}>
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      </div>
      <div className="grid gap-1 border-t border-sidebar-border p-3">
        <div className="flex h-9 items-center gap-3 px-3 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0">
          <Skeleton className="size-5 shrink-0" />
          <Skeleton className={`h-4 flex-1 ${COLLAPSED_HIDE}`} />
        </div>
        <div className="flex items-center gap-3 p-1.5 group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:p-0">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className={`h-4 flex-1 ${COLLAPSED_HIDE}`} />
        </div>
      </div>
    </div>
  );
}

function TopBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-2 backdrop-blur-sm lg:hidden"
    >
      <Skeleton className="size-11 shrink-0" />
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

/**
 * What stands in for the sidebar and the phone top bar while the session is
 * still loading: a hard load or refresh, or arriving from sign-in. It is the
 * shape of the real sidebar (the same rows, the same column), pulsing, so
 * nothing jumps when it lands. It appears only then: inside the app the
 * shell stays mounted between pages, so moving around never shows it again.
 * The page itself never waits for this: it streams with its own skeleton and
 * the page loader.
 */
export function ShellChromeFallback() {
  return (
    <>
      <SidebarSkeleton />
      <TopBarSkeleton />
    </>
  );
}
