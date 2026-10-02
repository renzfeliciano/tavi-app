import { AcknowledgementPaperSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A payment: the way back to its bill, the header and download button, then its receipt.
export default function PaymentLoading() {
  return (
    <LoadingScreen label="Loading payment">
      <PageHeaderSkeleton back title="w-64" description="w-40" actions={["w-36"]} />
      <div className="mt-6 max-w-3xl">
        <AcknowledgementPaperSkeleton />
      </div>
    </LoadingScreen>
  );
}
