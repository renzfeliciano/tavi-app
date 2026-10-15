import { AcknowledgementPaperSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A receipt: the way back to the list, the header with its buttons, then the paper.
export default function ReceiptLoading() {
  return (
    <LoadingScreen label="Loading receipt">
      <PageHeaderSkeleton back title="w-72" description="w-52" actions={["w-36", "w-32", "w-16"]} />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaperSkeleton />
      </div>
    </LoadingScreen>
  );
}
