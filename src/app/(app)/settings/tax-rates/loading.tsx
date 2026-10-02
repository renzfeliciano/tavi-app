import { Skeleton } from "@/components/ui/skeleton";
import {
  BadgeSkeleton,
  ButtonSkeleton,
  ListSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  ParagraphSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// Tax rates: the way back, the header, then the rates you charge with the add button.
export default function TaxRatesSettingsLoading() {
  return (
    <LoadingScreen label="Loading tax rates">
      <PageHeaderSkeleton back title="w-32" description="w-112" wraps="w-40" />
      <div className="mt-8 grid max-w-3xl gap-3">
        <div className="flex items-end justify-between gap-4">
          <TextSkeleton size="base" width="w-28" />
          <ButtonSkeleton width="w-32" />
        </div>
        <ListSkeleton
          rows={2}
          row={(i) => (
            <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <TextSkeleton size="base" width={vary(["w-28", "w-36"], i)} />
                <TextSkeleton width="w-12" />
                {i === 0 && <BadgeSkeleton />}
              </div>
              <Skeleton className="size-9 shrink-0 pointer-coarse:size-11" />
            </div>
          )}
        />
        <ParagraphSkeleton lines={2} />
      </div>
    </LoadingScreen>
  );
}
