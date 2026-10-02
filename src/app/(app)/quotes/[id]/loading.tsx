import { DocumentPaperSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A quote: the way back, its number, status and actions, then the quote itself.
export default function QuoteLoading() {
  return (
    <LoadingScreen label="Loading quote">
      <PageHeaderSkeleton back badge title="w-48" description="w-48" actions={["w-28", "w-24"]} />
      <div className="mt-6 max-w-3xl">
        <DocumentPaperSkeleton />
      </div>
    </LoadingScreen>
  );
}
