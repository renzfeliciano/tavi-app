import { Skeleton } from "@/components/ui/skeleton";
import { ButtonSkeleton, LoadingScreen, TextSkeleton } from "@/components/skeletons";

// The public home: the wordmark, the tagline, the two ways in.
export default function HomeLoading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <LoadingScreen label="Loading" className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-40 sm:h-12 sm:w-48" />
        <TextSkeleton size="lg" width="w-80" />
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <ButtonSkeleton size="lg" width="w-40" />
          <ButtonSkeleton size="lg" width="w-24" />
        </div>
      </LoadingScreen>
    </main>
  );
}
