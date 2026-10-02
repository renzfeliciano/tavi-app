import { DocumentEditorSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// Editing a sent bill: the way back, the header, then the editor with its lines.
export default function EditInvoiceLoading() {
  return (
    <LoadingScreen label="Loading bill">
      <PageHeaderSkeleton back title="w-56" description={["w-120", "w-32"]} />
      <DocumentEditorSkeleton lines={2} />
    </LoadingScreen>
  );
}
