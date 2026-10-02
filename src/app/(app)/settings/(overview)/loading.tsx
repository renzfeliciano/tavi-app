import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton, LoadingScreen, PageHeaderSkeleton, TextSkeleton, vary } from "@/components/skeletons";

// Settings: header, then one row per section, each with its icon, name, purpose and chevron.
export default function SettingsLoading() {
  return (
    <LoadingScreen label="Loading settings">
      <PageHeaderSkeleton title="w-32" description="w-96" />
      <ListSkeleton
        rows={7}
        className="mt-8"
        row={(i) => (
          <div className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 shrink-0" />
            <div className="grid flex-1 gap-0.5">
              <TextSkeleton size="base" width={vary(["w-36", "w-24", "w-40", "w-44"], i)} />
              <TextSkeleton width={vary(["w-80", "w-56", "w-72", "w-64"], i)} />
            </div>
            <Skeleton className="size-4 shrink-0" />
          </div>
        )}
      />
    </LoadingScreen>
  );
}
