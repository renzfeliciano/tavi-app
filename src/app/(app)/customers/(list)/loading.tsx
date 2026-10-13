import { ListSearchSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CustomerListSkeleton } from "../_components/customer-list";

// The customer list: header, search, then the table of customers.
export default function CustomersLoading() {
  return (
    <LoadingScreen label="Loading customers">
      <PageHeaderSkeleton title="w-40" description="w-72" actions={["w-36"]} />
      <div className="mt-8">
        <ListSearchSkeleton />
      </div>
      <CustomerListSkeleton />
    </LoadingScreen>
  );
}
