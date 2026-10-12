import { PageLoader } from "@/components/brand/page-loader";

/**
 * What a hard load, refresh or sign-in redirect shows while the app shell
 * itself is still loading (session, business, nav), before any page's own
 * loading.tsx can exist. An empty sidebar column and the page loader, placed
 * exactly where the real shell will put them, so nothing jumps when it lands.
 */
export function ShellLoading() {
  return (
    <div role="status" className="flex min-h-full flex-1 flex-col">
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block"
      />
      <div aria-hidden="true" className="flex-1 lg:pl-60 lg:[--page-loader-inset:15rem]">
        <PageLoader />
      </div>
    </div>
  );
}
