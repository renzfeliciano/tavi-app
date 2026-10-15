import { ListSearchSkeleton, ListViewsSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { OrderListSkeleton } from "../_components/order-list";

// Purchase orders: the header with its two buttons, search and the status tabs, then the table.
export default function PurchaseOrdersLoading() {
  return (
    <LoadingScreen label="Loading purchase orders">
      <PageHeaderSkeleton title="w-44" description="w-80" wraps="w-16" actions={["w-28", "w-48"]} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <ListViewsSkeleton views={["w-10", "w-16", "w-16", "w-20", "w-20"]} />
        </div>
      </div>
      <OrderListSkeleton />
    </LoadingScreen>
  );
}
