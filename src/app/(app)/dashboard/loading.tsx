import { ListSkeleton, LoadingScreen, PageHeaderSkeleton, TextSkeleton, vary } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One stage of the pipeline: its label, the count, what the stage is worth and what it means. */
function StageSkeleton({ label }: { label: string }) {
  return (
    <div className="bg-card px-4 py-3.5 max-sm:last:odd:col-span-2 sm:px-5">
      <TextSkeleton width={label} />
      <TextSkeleton size="2xl" width="w-8" className="mt-2" />
      <TextSkeleton size="xs" width="w-20" className="mt-0.5" />
      <TextSkeleton size="xs" width="w-20" className="mt-1" />
    </div>
  );
}

function PipelineRowSkeleton({ title, labels }: { title: string; labels: string[] }) {
  return (
    <div>
      <div className="px-4 pt-3 sm:px-5">
        <TextSkeleton width={title} />
      </div>
      <div className={cn("mt-2 grid grid-cols-2 gap-px bg-border", labels.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {labels.map((label, i) => (
          <StageSkeleton key={i} label={label} />
        ))}
      </div>
    </div>
  );
}

// The dashboard: header and quick actions, the money tiles, then what needs attention and where the work stands
// beside the recent activity.
export default function DashboardLoading() {
  return (
    <LoadingScreen label="Loading dashboard">
      <PageHeaderSkeleton title="w-40" description="w-56" actions={["w-32", "w-36", "w-36"]} />
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
        {["w-24", "w-28", "w-40"].map((width) => (
          <div key={width} className="bg-card px-5 py-4">
            <TextSkeleton width={width} />
            <TextSkeleton size="2xl" width="w-32" className="mt-1" />
            <TextSkeleton size="xs" width="w-36" className="mt-1" />
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-8">
        <div className="grid gap-10">
          <div>
            <TextSkeleton size="base" width="w-40" />
            <ListSkeleton
              rows={3}
              className="mt-3"
              row={(i) => (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 sm:gap-x-4 sm:px-5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="min-w-0">
                    <TextSkeleton size="xs" width="w-24" />
                    <TextSkeleton width={vary(["w-56", "w-48", "w-64"], i)} className="mt-0.5" />
                  </div>
                  <TextSkeleton width="w-20" />
                </div>
              )}
            />
          </div>
          <div>
            <TextSkeleton size="base" width="w-20" />
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <PipelineRowSkeleton title="w-24" labels={["w-14", "w-12", "w-16", "w-20"]} />
              <PipelineRowSkeleton title="w-36" labels={["w-14", "w-16", "w-20"]} />
            </div>
          </div>
        </div>
        <div>
          <TextSkeleton size="base" width="w-36" />
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {["w-16", "w-24"].map((day, d) => (
              <div key={day} className="pb-1.5">
                <div className="px-4 pt-3 pb-1 sm:px-5">
                  <TextSkeleton size="xs" width={day} />
                </div>
                {Array.from({ length: d === 0 ? 3 : 2 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-1.5 sm:px-5">
                    <Skeleton className="size-7 rounded-full" />
                    <TextSkeleton width={vary(["w-56", "w-44", "w-64"], i + d)} />
                    <TextSkeleton size="xs" width="w-12" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
