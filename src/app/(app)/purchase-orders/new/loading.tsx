import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { OrderFormSkeleton } from "../_components/order-form-skeleton";

// A new purchase order: the way back, the header, then the form.
export default function NewPurchaseOrderLoading() {
  return (
    <LoadingScreen label="Loading the form">
      <PageHeaderSkeleton back title="w-52" description="w-96" wraps="w-24" />
      <OrderFormSkeleton />
    </LoadingScreen>
  );
}
