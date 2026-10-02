import { DocumentEditorSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A new bill: the way back, the header, then the editor and its preview.
export default function NewInvoiceLoading() {
  return (
    <LoadingScreen label="Loading new bill">
      <PageHeaderSkeleton back title="w-40" description="w-36" />
      <DocumentEditorSkeleton />
    </LoadingScreen>
  );
}
