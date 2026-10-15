import { LoadingScreen, PageHeaderSkeleton, TextSkeleton, vary } from "@/components/skeletons";
import { StatusBadgeSkeleton } from "@/components/skeletons";

// A schedule: the way back, the customer and its buttons, the schedule's facts beside the items it repeats,
// then the statements it has made.
const CARD = "mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs";

export default function ScheduleLoading() {
  return (
    <LoadingScreen label="Loading recurring statement">
      <PageHeaderSkeleton back title="w-48" description="w-64" badge actions={["w-20", "w-24", "w-20"]} />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <section>
          <TextSkeleton size="base" width="w-24" />
          <div className={`${CARD} divide-y divide-border`}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 px-4 py-3 sm:px-5">
                <TextSkeleton width="w-20" />
                <TextSkeleton width={vary(["w-40", "w-32", "w-48"], i)} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <TextSkeleton size="base" width="w-36" />
          <div className={CARD}>
            <div className="divide-y divide-border">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="grid gap-1 px-4 py-3 sm:px-5">
                  <TextSkeleton width={vary(["w-44", "w-36"], i)} />
                  <TextSkeleton width="w-32" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 sm:px-5">
              <TextSkeleton width="w-24" />
              <TextSkeleton width="w-20" />
            </div>
          </div>
        </section>
      </div>
      <section className="mt-8">
        <TextSkeleton size="base" width="w-40" />
        <div className={`${CARD} divide-y divide-border`}>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 pointer-coarse:min-h-14">
              <span className="flex items-center gap-2">
                <TextSkeleton width="w-24" />
                <StatusBadgeSkeleton />
              </span>
              <TextSkeleton width="w-28" />
            </div>
          ))}
        </div>
      </section>
    </LoadingScreen>
  );
}
