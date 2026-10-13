import { ListSearchSkeleton, LoadingScreen, PageHeaderSkeleton, SummaryStripSkeleton } from "@/components/skeletons";
import { PaymentListSkeleton } from "../_components/payment-list";

// Payments: header, the summary strip, search, then the table of payments.
export default function PaymentsLoading() {
  return (
    <LoadingScreen label="Loading payments">
      <PageHeaderSkeleton title="w-32" description="w-72" />
      <SummaryStripSkeleton phoneHides={1} />
      <div className="mt-5">
        <ListSearchSkeleton />
      </div>
      <PaymentListSkeleton />
    </LoadingScreen>
  );
}
