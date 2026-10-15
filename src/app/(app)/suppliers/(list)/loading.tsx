import { ListSearchSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { SupplierListSkeleton } from "../_components/supplier-list";

// The supplier list: header, search, then the table of suppliers.
export default function SuppliersLoading() {
  return (
    <LoadingScreen label="Loading suppliers">
      <PageHeaderSkeleton title="w-40" description="w-72" actions={["w-36"]} />
      <div className="mt-8">
        <ListSearchSkeleton />
      </div>
      <SupplierListSkeleton />
    </LoadingScreen>
  );
}
