import { ListSearchSkeleton, ListViewsSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { ReceiptListSkeleton } from "../_components/receipt-list";

// Receipts: the way back to Payments, the header with its button, search and the kind tabs, then the table.
export default function ReceiptsLoading() {
  return (
    <LoadingScreen label="Loading receipts">
      <PageHeaderSkeleton back title="w-32" description="w-80" wraps="w-16" actions={["w-36"]} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-10", "w-36", "w-44", "w-16"]} />
      </div>
      <ReceiptListSkeleton />
    </LoadingScreen>
  );
}
