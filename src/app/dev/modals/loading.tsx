import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScreen, ParagraphSkeleton, TextSkeleton } from "@/components/skeletons";

// The modal samples: a header, then a grid of sample cards.
export default function ModalSamplesLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <LoadingScreen label="Loading the modal samples" className="grid gap-8">
        <div className="grid gap-3">
          <TextSkeleton size="3xl" width="w-56" />
          <ParagraphSkeleton lines={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["a", "b", "c", "d", "e", "f"].map((key) => (
            <Skeleton key={key} className="h-36 rounded-xl" />
          ))}
        </div>
      </LoadingScreen>
    </main>
  );
}
