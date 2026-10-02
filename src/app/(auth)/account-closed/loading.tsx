import { ButtonSkeleton, LoadingScreen, ParagraphSkeleton, TextSkeleton } from "@/components/skeletons";

// Account closed: the heading, what happened and what's kept, then the way home.
export default function AccountClosedLoading() {
  return (
    <LoadingScreen label="Loading">
      <div className="mb-6">
        <TextSkeleton size="xl" width="w-52" />
      </div>
      <div className="grid gap-4">
        <ParagraphSkeleton lines={4} />
        <ParagraphSkeleton lines={2} />
        <ParagraphSkeleton lines={2} />
        <div className="mt-2">
          <ButtonSkeleton width="w-full" />
        </div>
      </div>
    </LoadingScreen>
  );
}
