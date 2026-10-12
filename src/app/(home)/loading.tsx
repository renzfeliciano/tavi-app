import { Skeleton } from "@/components/ui/skeleton";
import { ButtonSkeleton, LoadingScreen, ParagraphSkeleton, TextSkeleton } from "@/components/skeletons";

// The public home: the header, then the headline and its two buttons beside the sample quotation.
// Skeleton only, no page loader: a first impression should not wait behind an animation.
export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <LoadingScreen label="Loading" loader={false} className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3 py-4">
          <Skeleton className="h-12 w-44" />
          <div className="flex gap-2">
            <ButtonSkeleton width="w-20" />
            <ButtonSkeleton width="w-28" />
          </div>
        </div>
        <div className="grid items-center gap-12 pt-6 pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-20">
          <div className="grid gap-6">
            <div>
              <TextSkeleton size="3xl" width="w-4/5" />
              <TextSkeleton size="3xl" width="w-2/5" />
            </div>
            <ParagraphSkeleton lines={3} size="lg" />
            <div className="flex flex-wrap gap-3">
              <ButtonSkeleton size="lg" width="w-44" />
              <ButtonSkeleton size="lg" width="w-44" />
            </div>
          </div>
          <Skeleton className="mx-auto h-80 w-full max-w-md rounded-xl lg:max-w-none" />
        </div>
      </LoadingScreen>
    </div>
  );
}
