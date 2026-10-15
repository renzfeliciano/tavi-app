import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { SupplierFormSkeleton } from "../_components/supplier-form-skeleton";

// Adding a supplier: the way back, the header, then the empty form.
export default function NewSupplierLoading() {
  return (
    <LoadingScreen label="Loading new supplier form">
      <PageHeaderSkeleton back title="w-40" description="w-96" wraps="w-24" />
      <SupplierFormSkeleton />
    </LoadingScreen>
  );
}
