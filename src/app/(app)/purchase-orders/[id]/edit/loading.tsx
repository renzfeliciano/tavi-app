import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { OrderFormSkeleton } from "../../_components/order-form-skeleton";

// Editing a draft purchase order: the way back, the header, then the form with its lines.
export default function EditPurchaseOrderLoading() {
  return (
    <LoadingScreen label="Loading the draft">
      <PageHeaderSkeleton back title="w-56" description="w-72" wraps="w-24" />
      <OrderFormSkeleton lines={1} />
    </LoadingScreen>
  );
}
