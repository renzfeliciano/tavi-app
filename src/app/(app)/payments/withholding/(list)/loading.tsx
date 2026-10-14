import { ListSearchSkeleton, ListViewsSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { PendingListSkeleton } from "../_components/pending-list";

// Withholding: the way back to Payments, the header with its button, search and the three tabs, then the
// waiting list (the first tab).
export default function WithholdingLoading() {
  return (
    <LoadingScreen label="Loading withholding">
      <PageHeaderSkeleton back title="w-56" description="w-96" wraps="w-16" actions={["w-32"]} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-44", "w-28", "w-16"]} />
      </div>
      <PendingListSkeleton />
    </LoadingScreen>
  );
}
