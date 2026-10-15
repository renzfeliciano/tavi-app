import {
  ListSearchSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SummaryStripSkeleton,
} from "@/components/skeletons";
import { PaymentListSkeleton } from "../_components/payment-list";

// Payments: header with its Receipts and Withholding buttons, the summary strip, search and the 2307 tabs (every market has withheld tax today), then the table of payments.
export default function PaymentsLoading() {
  return (
    <LoadingScreen label="Loading payments">
      <PageHeaderSkeleton title="w-32" description="w-72" actions={["w-28", "w-44"]} />
      <SummaryStripSkeleton phoneHides={1} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-24"]} />
      </div>
      <PaymentListSkeleton />
    </LoadingScreen>
  );
}
