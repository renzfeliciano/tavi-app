import { DocumentEditorSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A new quote: the way back, the header, then the editor and its preview.
export default function NewQuoteLoading() {
  return (
    <LoadingScreen label="Loading new quotation">
      <PageHeaderSkeleton back title="w-36" description="w-36" />
      <DocumentEditorSkeleton />
    </LoadingScreen>
  );
}
