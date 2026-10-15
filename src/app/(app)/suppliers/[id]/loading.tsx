import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { SupplierFormSkeleton } from "../_components/supplier-form-skeleton";

// A supplier: the way back, their name and archive button, then the details form.
export default function SupplierLoading() {
  return (
    <LoadingScreen label="Loading supplier">
      <PageHeaderSkeleton back title="w-48" description="w-72" wraps="w-20" actions={["w-28"]} />
      <SupplierFormSkeleton />
    </LoadingScreen>
  );
}
