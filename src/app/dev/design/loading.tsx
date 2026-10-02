import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScreen, ParagraphSkeleton, TextSkeleton } from "@/components/skeletons";

// The design system reference: its header, then sections of samples.
export default function DesignSystemLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <LoadingScreen label="Loading the design system" className="grid gap-10">
        <div className="grid gap-3">
          <TextSkeleton size="3xl" width="w-64" />
          <ParagraphSkeleton lines={2} />
        </div>
        {["w-28", "w-36", "w-24"].map((title) => (
          <div key={title} className="grid gap-4 border-t border-border pt-8">
            <TextSkeleton size="lg" width={title} />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ))}
      </LoadingScreen>
    </main>
  );
}
