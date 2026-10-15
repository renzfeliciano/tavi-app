import { ListSearchSkeleton, ListViewsSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { ScheduleListSkeleton } from "../_components/schedule-list";

// The recurring list: header, search and status tabs, then the table of schedules.
export default function RecurringLoading() {
  return (
    <LoadingScreen label="Loading recurring statements">
      <PageHeaderSkeleton title="w-32" description="w-96" />
      <div className="mt-8 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-20", "w-16", "w-16"]} />
      </div>
      <ScheduleListSkeleton />
    </LoadingScreen>
  );
}
