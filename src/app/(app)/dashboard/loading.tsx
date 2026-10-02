import { ListSkeleton, LoadingScreen, PageHeaderSkeleton, TextSkeleton, vary } from "@/components/skeletons";

// The dashboard: header and quick actions, the money tiles, what needs attention, recent activity.
export default function DashboardLoading() {
  return (
    <LoadingScreen label="Loading dashboard">
      <PageHeaderSkeleton title="w-40" description="w-56" actions={["w-32", "w-36", "w-36"]} />
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
        {["w-24", "w-28", "w-20"].map((width) => (
          <div key={width} className="bg-card px-5 py-4">
            <TextSkeleton width={width} />
            <TextSkeleton size="2xl" width="w-32" className="mt-1" />
          </div>
        ))}
      </div>
      <div className="mt-10">
        <TextSkeleton size="base" width="w-36" />
        <ListSkeleton
          rows={3}
          className="mt-3"
          row={(i) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3.5 sm:px-6">
              <div className="min-w-0">
                <TextSkeleton size="xs" width="w-24" />
                <TextSkeleton width={vary(["w-56", "w-48", "w-64"], i)} className="mt-0.5" />
              </div>
              <TextSkeleton width="w-20" />
            </div>
          )}
        />
      </div>
      <div className="mt-10">
        <TextSkeleton size="base" width="w-32" />
        <div className="mt-3 grid gap-2">
          {["w-64", "w-56", "w-72", "w-48"].map((width) => (
            <div key={width} className="flex flex-wrap items-center justify-between gap-x-4">
              <TextSkeleton width={width} />
              <TextSkeleton width="w-20" />
            </div>
          ))}
        </div>
      </div>
    </LoadingScreen>
  );
}
