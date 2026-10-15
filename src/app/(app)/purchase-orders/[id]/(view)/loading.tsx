import {
  DocumentPaperSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
} from "@/components/skeletons";

// A purchase order: the way back to the list, the header with its buttons, then the paper.
export default function PurchaseOrderLoading() {
  return (
    <LoadingScreen label="Loading purchase order">
      <PageHeaderSkeleton
        back
        title="w-72"
        description="w-64"
        wraps="w-24"
        actions={["w-24", "w-36", "w-36", "w-32", "w-36"]}
      />
      <div className="mt-6 max-w-3xl">
        <DocumentPaperSkeleton />
      </div>
    </LoadingScreen>
  );
}
